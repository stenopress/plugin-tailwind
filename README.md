# @steno/plugin-tailwind

Tailwind CSS v4 plugin for [Steno](https://github.com/steno/steno) via the Tailwind CLI.

After each build, scans your output HTML for Tailwind classes and generates a single CSS file at `dist/assets/tailwind.css`.

## Requirements

Node.js and npm must be available in your environment.  
The plugin automatically installs `tailwindcss` and `@tailwindcss/cli` into a cached temp toolchain directory on first run.

## Installation

````yaml
# content/.steno/config.yml
plugins:
  - jsr:@steno/plugin-tailwind
````

## Options

````yaml
plugins:
  - package: jsr:@steno/plugin-tailwind
    options:
      input: ./src/styles.css
      minify: true
````

| Option    | Type      | Default                        | Description                                      |
|-----------|-----------|--------------------------------|--------------------------------------------------|
| `input`   | `string`  | auto-generated `@import "tailwindcss"` | Path to your CSS entry file            |
| `minify`  | `boolean` | `false`                        | Whether to minify the generated CSS              |

## Usage

Add the generated stylesheet to your theme layout:

````html
<link rel="stylesheet" href="/assets/tailwind.css" />
````

Then use Tailwind classes in your Markdown or theme templates as normal:

````md
<div class="text-3xl font-bold text-blue-500">
  Hello from Steno!
</div>
````

## Custom CSS entry file

By default the plugin generates a minimal entry file:

````css
@import "tailwindcss";
````

To add custom styles or Tailwind configuration, provide your own input file:

````css
/* src/styles.css */
@import "tailwindcss";

@layer base {
  h1 {
    @apply text-4xl font-bold;
  }
}
````

````yaml
plugins:
  - package: jsr:@steno/plugin-tailwind
    options:
      input: ./src/styles.css
````

## How it works

The plugin hooks into Steno's `afterBuild` lifecycle. Once all pages are written to `dist/`, it:

1. Resolves or creates a CSS entry file
2. Rewrites `@import "tailwindcss"` to a resolved local package path and appends `@source "<outputDir>"`
3. Runs `npx @tailwindcss/cli -i <prepared-input> -o dist/assets/tailwind.css`
4. Cleans up temporary files

## License

MIT