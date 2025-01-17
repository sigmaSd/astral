import { existsSync } from "https://deno.land/std@0.205.0/fs/exists.ts";
import { getBinary } from "../../../src/cache.ts";

export interface JSDocable {
  description?: string;
  experimental?: boolean;
  deprecated?: boolean;
}

export type ObjectProperty =
  & JSDocable
  & {
    name: string;
    optional?: boolean;
  }
  & (
    {
      type: "number" | "integer" | "boolean" | "any" | "object" | "binary";
    } | {
      type: "string";
      enum?: string[];
    } | {
      type: "array";
      items: {
        $ref: string;
      } | {
        type: "number" | "string" | "integer" | "any";
      };
    } | {
      $ref: string;
    }
  );

export type Type =
  & JSDocable
  & {
    id: string;
  }
  & (
    {
      type: "string";
      enum?: string[];
    } | {
      type: "number" | "integer";
    } | {
      type: "object";
      properties?: ObjectProperty[];
    } | {
      type: "array";
      items: {
        $ref: string;
      } | {
        type: "number" | "string" | "integer" | "any";
      };
    }
  );

export type CommandParameter =
  & JSDocable
  & {
    name: string;
    optional?: boolean;
  }
  & (
    {
      type: "boolean" | "integer" | "number" | "binary";
    } | {
      type: "string";
      enum?: string[];
    } | {
      type: "array";
      items: {
        $ref: string;
      } | {
        type: "string";
      };
    } | {
      $ref: string;
    }
  );

export type Command = JSDocable & {
  name: string;
  parameters?: CommandParameter[];
  // TODO: verify typing here
  returns?: CommandParameter[];
};

export type Event = JSDocable & {
  name: string;
  // TODO: verify typing here
  parameters?: CommandParameter[];
};

export type Domain = JSDocable & {
  domain: string;
  dependencies?: string[];
  types?: Type[];
  events?: Event[];
  commands?: Command[];
};

export interface Protocol {
  version: {
    major: number;
    minor: number;
  };
  domains: Domain[];
}

export async function getProtocol(): Promise<Protocol> {
  if (existsSync("types.json")) {
    return JSON.parse(Deno.readTextFileSync("types.json"));
  } else {
    // Configuration
    const path = await getBinary("chrome");

    // Launch child process
    const launch = new Deno.Command(path, {
      args: [
        "-remote-debugging-port=9222",
        "--headless=new",
      ],
      stderr: "piped",
    });
    const process = launch.spawn();

    const reader = process.stderr
      .pipeThrough(new TextDecoderStream())
      .getReader();

    let message: string | undefined;
    do {
      message = (await reader.read()).value;
    } while (message && !message.includes("127.0.0.1:9222"));

    // Get protocol information and close process
    const protocolReq = await fetch("http://localhost:9222/json/protocol");
    const res = await protocolReq.json();
    process.kill();
    return res;
  }
}
