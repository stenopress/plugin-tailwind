import { assert, assertStringIncludes } from "@std/assert";
import { join } from "@std/path";
import tailwindPlugin from "./mod.ts";
import type { SiteConfig } from "steno";

function makeConfig(outputDir: string): SiteConfig {
    return {
        title: "Test",
        description: "Test",
        author: "Tester",
        output: outputDir,
    };
}

Deno.test({
    name: "tailwind: generates tailwind.css in dist/assets",
    permissions: { read: true, write: true, run: true },
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

        const css = Deno.readTextFileSync(join(outputDir, "assets", "tailwind.css"));
        assert(css.length > 0);
        assertStringIncludes(css, "font-bold");
    },
});

Deno.test({
    name: "tailwind: accepts custom input css",
    permissions: { read: true, write: true, run: true },
    fn: async () => {
        const tempDir = Deno.makeTempDirSync();
        const outputDir = join(tempDir, "dist");
        Deno.mkdirSync(join(outputDir, "assets"), { recursive: true });

        // Write custom input CSS
        const inputCss = join(tempDir, "input.css");
        Deno.writeTextFileSync(inputCss, `@import "tailwindcss";\n`);

        Deno.writeTextFileSync(
            join(outputDir, "index.html"),
            `<p class="text-red-500">Hello</p>`,
        );

        const plugin = tailwindPlugin({ input: inputCss });
        await plugin.afterBuild!(makeConfig(outputDir));

        const css = Deno.readTextFileSync(join(outputDir, "assets", "tailwind.css"));
        assert(css.length > 0);
    },
});

Deno.test({
    name: "tailwind: minify option produces smaller output",
    permissions: { read: true, write: true, run: true },
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
    name: "tailwind: throws if input css does not exist",
    permissions: { read: true, write: true, run: true },
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