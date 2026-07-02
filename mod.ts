/**
 * Steno plugin for Tailwind CSS v4 via the Tailwind CLI.
 *
 * Scans the built HTML output and generates a CSS file at `dist/assets/tailwind.css`.
 *
 * @example
 * ```yaml
 * plugins:
 *   - jsr:@steno/plugin-tailwind
 * ```
 *
 * @example with options
 * ```yaml
 * plugins:
 *   - package: jsr:@steno/plugin-tailwind
 *     options:
 *       input: ./src/styles.css
 *       minify: true
 * ```
 *
 * @module
 */

import type { SiteConfig, StenoPlugin } from "steno";
import { join } from "@std/path";
import { ensureDirSync } from "@std/fs";

export interface TailwindPluginOptions {
    /** Path to a custom CSS entry file. Defaults to an auto-generated file with `@import "tailwindcss"`. */
    input?: string;
    /** Whether to minify the output CSS. Defaults to false. */
    minify?: boolean;
}

const DEFAULT_INPUT_CSS = `@import "tailwindcss";\n`;
const TOOLCHAIN_DIR = join(
    Deno.env.get("TMPDIR") ?? "/tmp",
    "steno-plugin-tailwind-toolchain",
);
const TAILWIND_CSS_ENTRY = join(
    TOOLCHAIN_DIR,
    "node_modules",
    "tailwindcss",
    "index.css",
);
const TAILWIND_IMPORT_RE = /@import\s+["']tailwindcss["'];?/g;

export type TailwindStenoPlugin = StenoPlugin & {
    afterBuild: (config: SiteConfig) => Promise<void>;
};

async function ensureTailwindToolchain(): Promise<void> {
    ensureDirSync(TOOLCHAIN_DIR);

    const packageJsonPath = join(TOOLCHAIN_DIR, "package.json");
    try {
        await Deno.stat(packageJsonPath);
    } catch {
        await Deno.writeTextFile(packageJsonPath, "{}\n");
    }

    try {
        await Deno.stat(TAILWIND_CSS_ENTRY);
        return;
    } catch {
        // Install below when the package isn't available yet.
    }

    const install = new Deno.Command("npm", {
        cwd: TOOLCHAIN_DIR,
        args: [
            "install",
            "--silent",
            "--no-audit",
            "--no-fund",
            "tailwindcss",
            "@tailwindcss/cli",
        ],
        stdout: "piped",
        stderr: "piped",
    });
    const { code, stderr } = await install.output();
    if (code !== 0) {
        const error = new TextDecoder().decode(stderr);
        throw new Error(
            `Failed to install Tailwind CLI toolchain (exit code ${code}):\n${error}`,
        );
    }
}

function makeBuildInputCss(sourceCss: string, outputDir: string): string {
    const hasTailwindImport = /@import\s+["']tailwindcss["'];?/.test(sourceCss);
    const cssWithResolvedImport = hasTailwindImport
        ? sourceCss.replace(TAILWIND_IMPORT_RE, `@import "${TAILWIND_CSS_ENTRY}";`)
        : `@import "${TAILWIND_CSS_ENTRY}";\n${sourceCss}`;

    return `${cssWithResolvedImport}\n@source "${outputDir}";\n`;
}

export default function tailwindPlugin(
    options: TailwindPluginOptions = {},
): TailwindStenoPlugin {
    return {
        name: "steno-plugin-tailwind",

        afterBuild: async (config: SiteConfig) => {
            const outputDir = config.output ?? "dist";
            const sourceDir = outputDir.startsWith("/")
                ? outputDir
                : join(Deno.cwd(), outputDir);
            const assetsDir = join(outputDir, "assets");
            const outputCss = join(assetsDir, "tailwind.css");

            ensureDirSync(assetsDir);
            await ensureTailwindToolchain();

            const sourceCss = options.input
                ? await Deno.readTextFile(options.input)
                : DEFAULT_INPUT_CSS;
            const buildInputCss = makeBuildInputCss(sourceCss, sourceDir);
            const tempFile = await Deno.makeTempFile({ suffix: ".css" });
            await Deno.writeTextFile(tempFile, buildInputCss);

            const args = [
                "@tailwindcss/cli",
                "-i",
                tempFile,
                "-o", outputCss,
            ];

            if (options.minify) {
                args.push("--minify");
            }

            try {
                const command = new Deno.Command("npx", {
                    cwd: TOOLCHAIN_DIR,
                    args,
                    stdout: "piped",
                    stderr: "piped",
                });

                const { code, stderr } = await command.output();

                if (code !== 0) {
                    const error = new TextDecoder().decode(stderr);
                    throw new Error(
                        `Tailwind CLI failed with exit code ${code}:\n${error}`,
                    );
                }

                console.log(`[steno-plugin-tailwind] Generated ${outputCss}`);
            } finally {
                await Deno.remove(tempFile);
            }
        },
    };
}