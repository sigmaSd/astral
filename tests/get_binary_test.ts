import { assertMatch } from "https://deno.land/std@0.205.0/assert/assert_match.ts";
import { cleanCache, getBinary, launch } from "../mod.ts";
import { assert } from "https://deno.land/std@0.205.0/assert/assert.ts";
import { assertRejects } from "https://deno.land/std@0.205.0/assert/assert_rejects.ts";
import { resolve } from "https://deno.land/std@0.205.0/path/resolve.ts";
import { assertStringIncludes } from "https://deno.land/std@0.205.0/assert/assert_string_includes.ts";

// Tests should be performed in directory different from others tests as cache is cleaned during this one
Deno.env.set("ASTRAL_QUIET_INSTALL", "true");
const cache = await Deno.makeTempDir({ prefix: "astral_test_get_binary" });
const permissions = {
  write: [
    cache,
    // Chromium lock on Linux
    `${Deno.env.get("HOME")}/.config/chromium/SingletonLock`,
    // Chromium lock on MacOS
    `${
      Deno.env.get("HOME")
    }/Library/Application Support/Chromium/SingletonLock`,
  ],
  env: ["CI", "ASTRAL_QUIET_INSTALL"],
  read: [cache],
  net: true,
  run: true,
};

Deno.test("Test download", { permissions }, async () => {
  // Download browser
  await cleanCache({ cache });
  const path = await getBinary("chrome", { cache });
  assertStringIncludes(path, cache);

  // Ensure browser is executable
  // Note: it seems that on Windows the --version flag does not exists and spawn a
  //   browser instance instead. The next test ensure that everything is working
  //   properly anyways
  if (Deno.build.os !== "windows") {
    const command = new Deno.Command(path, {
      args: [
        "--version",
      ],
    });
    const { success, stdout } = await command.output();
    assert(success);
    assertMatch(new TextDecoder().decode(stdout), /Google Chrome/i);
  }

  // Ensure browser is capable of loading pages
  const browser = await launch({ path });
  const page = await browser.newPage("http://example.com");
  await page.waitForSelector("h1");
  await browser.close();
});

Deno.test("Test download after failure", { permissions }, async () => {
  await cleanCache({ cache });
  const testCache = resolve(cache, "test_failure");

  // Test download failure (create a file instead of directory as the cache to force a write error)
  await Deno.mkdir(cache, { recursive: true });
  await Deno.writeTextFile(testCache, "");
  await assertRejects(
    () => getBinary("chrome", { cache: testCache }),
    "Not a directory",
  );

  // Retry download
  await Deno.remove(testCache, { recursive: true });
  assert(await getBinary("chrome", { cache: testCache }));
});

Deno.test("Clean cache after tests", async () => {
  await cleanCache({ cache });
});
