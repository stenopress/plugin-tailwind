import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import tailwindPlugin from "./mod.ts";
import type { SiteConfig } from "steno";

function makeConfig(outputDir?: string): SiteConfig {
  return {
    title: "Test",
    description: "Test",
    author: "Tester",
    output: outputDir,
  };
}

Deno.test({
  name: "tailwind: exposes the expected plugin name",
  fn: () => {
    const plugin = tailwindPlugin();
    assertEquals(plugin.name, "steno-plugin-tailwind");
  },
});

Deno.test({
  name: "tailwind: generates tailwind.css in dist/assets",
  permissions: { read: true, write: true, run: true, env: true },
  fn: async () => {
    const tempDir = Deno.makeTempDirSync();
    const outputDir = join(tempDir, "dist");
    Deno.mkdirSync(join(outputDir, "assets"), { recursive: true });

    // Write a minimal HTML file with a Tailwind class
    Deno.writeTextFileSync(
      join(outputDir, "index.html"),
      `<h1 class="text-3xl font-bold">Hello</h1>`,
    );

    const plugin = tailwindPlugin();
    await plugin.afterBuild!(makeConfig(outputDir));

    const css = Deno.readTextFileSync(
      join(outputDir, "assets", "tailwind.css"),
    );
    assert(css.length > 0);
    assertStringIncludes(css, "font-bold");
  },
});

Deno.test({
  name: "tailwind: only emits utilities actually used in the scanned output",
  permissions: { read: true, write: true, run: true, env: true },
  fn: async () => {
    const tempDir = Deno.makeTempDirSync();
    const outputDir = join(tempDir, "dist");
    Deno.mkdirSync(join(outputDir, "assets"), { recursive: true });

    Deno.writeTextFileSync(
      join(outputDir, "index.html"),
      `<p class="text-emerald-500">Used</p>`,
    );

    const plugin = tailwindPlugin();
    await plugin.afterBuild!(makeConfig(outputDir));

    const css = Deno.readTextFileSync(
      join(outputDir, "assets", "tailwind.css"),
    );
    assertStringIncludes(css, "text-emerald-500");
    // A class that never appears in the scanned HTML must not be generated.
    assert(!css.includes("text-fuchsia-900"));
  },
});

Deno.test({
  name: "tailwind: accepts custom input css and preserves extra rules",
  permissions: { read: true, write: true, run: true, env: true },
  fn: async () => {
    const tempDir = Deno.makeTempDirSync();
    const outputDir = join(tempDir, "dist");
    Deno.mkdirSync(join(outputDir, "assets"), { recursive: true });

    const inputCss = join(tempDir, "input.css");
    Deno.writeTextFileSync(
      inputCss,
      `@import "tailwindcss";\n.custom-banner { color: rebeccapurple; }\n`,
    );

    Deno.writeTextFileSync(
      join(outputDir, "index.html"),
      `<p class="text-red-500">Hello</p>`,
    );

    const plugin = tailwindPlugin({ input: inputCss });
    await plugin.afterBuild!(makeConfig(outputDir));

    const css = Deno.readTextFileSync(
      join(outputDir, "assets", "tailwind.css"),
    );
    assert(css.length > 0);
    assertStringIncludes(css, "text-red-500");
    assertStringIncludes(css, ".custom-banner");
    assertStringIncludes(css, "rebeccapurple");
  },
});

Deno.test({
  name:
    "tailwind: auto-prepends the tailwindcss import when input css omits it",
  permissions: { read: true, write: true, run: true, env: true },
  fn: async () => {
    const tempDir = Deno.makeTempDirSync();
    const outputDir = join(tempDir, "dist");
    Deno.mkdirSync(join(outputDir, "assets"), { recursive: true });

    const inputCss = join(tempDir, "input.css");
    Deno.writeTextFileSync(inputCss, `.custom-only { color: teal; }\n`);

    Deno.writeTextFileSync(
      join(outputDir, "index.html"),
      `<p class="text-red-500">Hello</p>`,
    );

    const plugin = tailwindPlugin({ input: inputCss });
    await plugin.afterBuild!(makeConfig(outputDir));

    const css = Deno.readTextFileSync(
      join(outputDir, "assets", "tailwind.css"),
    );
    // Utilities are still generated even though the tailwind import was implicit.
    assertStringIncludes(css, "text-red-500");
    assertStringIncludes(css, ".custom-only");
  },
});

Deno.test({
  name: "tailwind: minify option produces smaller output",
  permissions: { read: true, write: true, run: true, env: true },
  fn: async () => {
    const tempDir = Deno.makeTempDirSync();
    const outputDir = join(tempDir, "dist");
    Deno.mkdirSync(join(outputDir, "assets"), { recursive: true });

    Deno.writeTextFileSync(
      join(outputDir, "index.html"),
      `<p class="text-blue-500 font-bold">Hello</p>`,
    );

    const normal = tailwindPlugin();
    await normal.afterBuild!(makeConfig(outputDir));
    const normalSize = Deno.readTextFileSync(
      join(outputDir, "assets", "tailwind.css"),
    ).length;

    const minified = tailwindPlugin({ minify: true });
    await minified.afterBuild!(makeConfig(outputDir));
    const minifiedSize = Deno.readTextFileSync(
      join(outputDir, "assets", "tailwind.css"),
    ).length;

    assert(minifiedSize < normalSize);
  },
});

Deno.test({
  name: "tailwind: defaults to the dist directory when output is unset",
  permissions: { read: true, write: true, run: true, env: true },
  fn: async () => {
    const tempDir = Deno.makeTempDirSync();
    const originalCwd = Deno.cwd();
    Deno.chdir(tempDir);

    try {
      Deno.mkdirSync(join("dist", "assets"), { recursive: true });
      Deno.writeTextFileSync(
        join("dist", "index.html"),
        `<p class="italic">Hello</p>`,
      );

      const plugin = tailwindPlugin();
      await plugin.afterBuild!(makeConfig(undefined));

      const css = Deno.readTextFileSync(join("dist", "assets", "tailwind.css"));
      assertStringIncludes(css, "italic");
    } finally {
      Deno.chdir(originalCwd);
    }
  },
});

Deno.test({
  name: "tailwind: throws if input css does not exist",
  permissions: { read: true, write: true, run: true, env: true },
  fn: async () => {
    const tempDir = Deno.makeTempDirSync();
    const outputDir = join(tempDir, "dist");

    // Provide a nonexistent input file
    const plugin = tailwindPlugin({ input: "/nonexistent/input.css" });

    let threw = false;
    try {
      await plugin.afterBuild!(makeConfig(outputDir));
    } catch (e) {
      threw = true;
      assertStringIncludes((e as Error).message, "/nonexistent/input.css");
    }

    assert(threw);
  },
});

Deno.test({
  name: "tailwind: surfaces the Tailwind CLI's stderr when it exits non-zero",
  permissions: { read: true, write: true, run: true, env: true },
  fn: async () => {
    const tempDir = Deno.makeTempDirSync();
    const outputDir = join(tempDir, "dist");
    Deno.mkdirSync(join(outputDir, "assets"), { recursive: true });
    Deno.writeTextFileSync(join(outputDir, "index.html"), `<p>Hello</p>`);

    const originalStat = Deno.stat;
    const originalCommand = Deno.Command;

    // Pretend the toolchain is already installed so we skip straight to the
    // CLI invocation, then make that invocation fail.
    Deno.stat = (): Promise<Deno.FileInfo> => {
      return Promise.resolve({} as Deno.FileInfo);
    };

    class FailingCommand {
      constructor(_cmd: string, _options: Deno.CommandOptions) {}
      output(): Promise<Deno.CommandOutput> {
        return Promise.resolve({
          code: 1,
          success: false,
          signal: null,
          stdout: new Uint8Array(),
          stderr: new TextEncoder().encode("boom: invalid css"),
        });
      }
    }
    // deno-lint-ignore no-explicit-any
    Deno.Command = FailingCommand as any;

    try {
      const plugin = tailwindPlugin();
      let threw = false;
      try {
        await plugin.afterBuild!(makeConfig(outputDir));
      } catch (e) {
        threw = true;
        assertStringIncludes((e as Error).message, "Tailwind CLI failed");
        assertStringIncludes((e as Error).message, "boom: invalid css");
      }
      assert(threw, "expected afterBuild to throw when the CLI fails");
    } finally {
      Deno.stat = originalStat;
      Deno.Command = originalCommand;
    }
  },
});

Deno.test({
  name: "tailwind: surfaces npm's stderr when toolchain install fails",
  permissions: { read: true, write: true, run: true, env: true },
  fn: async () => {
    const tempDir = Deno.makeTempDirSync();
    const outputDir = join(tempDir, "dist");
    Deno.mkdirSync(join(outputDir, "assets"), { recursive: true });
    Deno.writeTextFileSync(join(outputDir, "index.html"), `<p>Hello</p>`);

    const originalStat = Deno.stat;
    const originalCommand = Deno.Command;

    Deno.stat = (path: string | URL): Promise<Deno.FileInfo> => {
      // package.json already present, but the tailwindcss package itself is
      // missing, forcing the install path.
      if (String(path).endsWith("package.json")) {
        return Promise.resolve({} as Deno.FileInfo);
      }
      return Promise.reject(new Deno.errors.NotFound());
    };

    class FailingInstallCommand {
      constructor(_cmd: string, _options: Deno.CommandOptions) {}
      output(): Promise<Deno.CommandOutput> {
        return Promise.resolve({
          code: 1,
          success: false,
          signal: null,
          stdout: new Uint8Array(),
          stderr: new TextEncoder().encode("network error: ETIMEDOUT"),
        });
      }
    }
    // deno-lint-ignore no-explicit-any
    Deno.Command = FailingInstallCommand as any;

    try {
      const plugin = tailwindPlugin();
      let threw = false;
      try {
        await plugin.afterBuild!(makeConfig(outputDir));
      } catch (e) {
        threw = true;
        assertStringIncludes(
          (e as Error).message,
          "Failed to install Tailwind CLI toolchain",
        );
        assertStringIncludes((e as Error).message, "network error: ETIMEDOUT");
      }
      assert(threw, "expected afterBuild to throw when the install fails");
    } finally {
      Deno.stat = originalStat;
      Deno.Command = originalCommand;
    }
  },
});
