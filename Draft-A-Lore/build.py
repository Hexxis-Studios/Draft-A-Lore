#!/usr/bin/env python3
"""Web build: inlines src/ and assets/ into one self-contained HTML file.

Every asset the page references — logo, favicon, PWA icons and the web app
manifest — is embedded as a data URI, so dist/DraftALore.html works on its own
with nothing beside it. That matters because releases/ ships the HTML by itself:
when the icons were linked as separate files, downloading just the HTML gave a
page with a broken logo and no icons.

The same file is copied to releases/ next to the Windows installer, along with
the .ico the Windows shortcut needs as a real file.
"""
import base64
import json
import mimetypes
import os
import shutil
import sys
import subprocess
import re

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(BASE, 'src')
ASSETS = os.path.join(BASE, 'assets')
DIST = os.path.join(BASE, 'dist')
RELEASES = os.path.join(BASE, 'releases')

OUTPUT_NAME = 'DraftALore.html'

# Also written to dist/ as real files. The page itself does not need them —
# everything is embedded — but keeping them makes dist/ usable as a normal web
# root, and the .ico is what the Windows shortcut points at.
DIST_ASSETS = ('favicon.ico', 'manifest.webmanifest', 'logo.png')

# Icon sizes embedded as <link rel="icon">. Kept deliberately small: the large
# sizes are only needed for install prompts, and those come through the manifest.
FAVICON_PNGS = ('icon-32.png', 'icon-192.png')
APPLE_TOUCH = 'apple-touch-icon.png'

# Icons embedded in the inlined manifest. An installer needs one standard square
# and one maskable square per platform; the rest only inflate the HTML.
MANIFEST_ICONS = ('icon-192.png', 'icon-512.png', 'maskable-192.png', 'maskable-512.png')


def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()


def data_uri(path):
    """Return `path` as a base64 data URI, or None when the file is absent.

    A Git LFS pointer stub is treated as absent: it is a small text file
    standing in for the real bytes, and embedding it would produce a valid-
    looking but broken image. Run `pplx project files hydrate-lfs <path>` to
    materialize the real asset before building.
    """
    if not os.path.isfile(path):
        return None
    with open(path, 'rb') as f:
        raw = f.read()
    if raw[:40].startswith(b'version https://git-lfs.github.com/spec/v1'):
        print(f'  ! skipped {os.path.relpath(path, BASE)} — unhydrated LFS pointer')
        return None
    mime = mimetypes.guess_type(path)[0] or 'application/octet-stream'
    return 'data:' + mime + ';base64,' + base64.b64encode(raw).decode('ascii')


def icon_uri(name):
    return data_uri(os.path.join(ASSETS, 'icons', name))


def build_manifest_uri():
    """Embed the web app manifest with its icon paths rewritten to data URIs.

    A manifest loaded from a data: URL cannot resolve relative icon paths, so
    each icon has to carry its own bytes.
    """
    path = os.path.join(ASSETS, 'manifest.webmanifest')
    if not os.path.isfile(path):
        return None
    manifest = json.loads(read_file(path))
    icons = []
    for icon in manifest.get('icons', []):
        # Embedding every declared size would add most of a megabyte of base64 for
        # no benefit: installers pick one square icon and one maskable icon and
        # scale from there. dist/icons/ still holds the full set as real files.
        if os.path.basename(icon['src']) not in MANIFEST_ICONS:
            continue
        uri = data_uri(os.path.join(ASSETS, icon['src']))
        if uri:
            icons.append({**icon, 'src': uri})
    manifest['icons'] = icons
    # start_url and scope cannot be relative to a data: URL either.
    manifest.pop('scope', None)
    manifest['start_url'] = '.'
    packed = json.dumps(manifest, separators=(',', ':'))
    return 'data:application/manifest+json;base64,' + base64.b64encode(packed.encode()).decode('ascii')


def render_html(include_web_metadata=True):
    """Return the complete single-file HTML document as a string."""
    # styles.css carries the tokens and shared components; styles-<area>.css files
    # hold component styles owned by one view, appended in sorted order so the
    # cascade stays predictable no matter which files exist.
    css_parts = [read_file(os.path.join(SRC, 'styles.css'))]
    for name in sorted(os.listdir(SRC)):
        if name.startswith('styles-') and name.endswith('.css'):
            css_parts.append(read_file(os.path.join(SRC, name)))
    css = '\n\n'.join(p for p in css_parts if p)

    # Assets the running app asks for by name, handed to it as data URIs so no
    # network or filesystem lookup is involved. core.js falls back to the plain
    # filenames when this object is missing, which keeps src/ servable as-is.
    runtime_assets = {}
    logo = data_uri(os.path.join(ASSETS, 'logo.png'))
    if logo:
        runtime_assets['logo'] = logo
    policy_source = read_file(os.path.join(BASE, 'privacy-policy.html'))
    policy_match = re.search(r'<main>([\s\S]*?)</main>', policy_source)
    if not policy_match or 'Optional dictation and read aloud' not in policy_match.group(1):
        raise ValueError('The complete public privacy policy must be included in the offline app.')
    policy_content = policy_match.group(1)
    if re.search(r'<(?:script|iframe|object|embed)\b|\son\w+\s*=|javascript:', policy_content, re.I):
        raise ValueError('Privacy policy content must not include active embedded content.')
    asset_js = 'window.DAL_ASSETS=' + json.dumps(runtime_assets, separators=(',', ':')) + ';\nwindow.DAL_PRIVACY_CONTENT=' + json.dumps(policy_content, ensure_ascii=False) + ';'

    core_js = read_file(os.path.join(SRC, 'core.js'))
    interaction_js = read_file(os.path.join(SRC, 'interaction.js'))
    views_js = read_file(os.path.join(SRC, 'views.js'))
    story_js = read_file(os.path.join(SRC, 'story-tools.js'))
    world_js = read_file(os.path.join(SRC, 'world-tools.js'))
    continuity_js = read_file(os.path.join(SRC, 'continuity-tools.js'))
    encyclopedia_js = read_file(os.path.join(SRC, 'encyclopedia-tools.js'))
    world_analysis_js = read_file(os.path.join(SRC, 'world-analysis.js'))
    analytics_js = read_file(os.path.join(SRC, 'analytics-tools.js'))
    publishing_js = read_file(os.path.join(SRC, 'publishing-tools.js'))
    sync_js = read_file(os.path.join(SRC, 'sync-tools.js'))
    writer_js = read_file(os.path.join(SRC, 'writer-tools.js'))
    voice_js = read_file(os.path.join(SRC, 'voice-tools.js'))
    rpg_js = read_file(os.path.join(SRC, 'rpg-engine.js'))
    adventure_js = read_file(os.path.join(SRC, 'adventure-tools.js'))
    assets_audio_js = read_file(os.path.join(SRC, 'assets-audio.js'))
    native_narration_js = read_file(os.path.join(SRC, 'native-narration.js'))
    native_export_js = read_file(os.path.join(SRC, 'native-export.js'))
    locale_vendor_js = read_file(os.path.join(BASE, 'node_modules', 'i18next', 'dist', 'umd', 'i18next.min.js')) + '\n' + read_file(os.path.join(BASE, 'node_modules', 'i18next-icu', 'i18nextICU.min.js'))
    locale_licenses = []
    for package, license_name in [('i18next', 'LICENSE'), ('i18next-icu', 'LICENSE'), ('intl-messageformat', 'LICENSE.md'), ('@formatjs/fast-memoize', 'LICENSE.md'), ('@formatjs/icu-messageformat-parser', 'LICENSE.md'), ('@formatjs/icu-skeleton-parser', 'LICENSE.md')]:
        license_path = os.path.join(BASE, 'node_modules', package, license_name)
        with open(license_path, encoding='utf-8') as license_file:
            locale_licenses.append(package + '\n' + license_file.read())
    locale_vendor_js = '/*! Bundled localization library licenses\n' + '\n\n'.join(locale_licenses).replace('*/', '* /') + '\n*/\n' + locale_vendor_js
    localization_js = read_file(os.path.join(SRC, 'localization.js'))
    with open(os.path.join(SRC, 'locales', 'catalog.json'), encoding='utf-8') as catalog_file:
        locale_catalog = json.load(catalog_file)
    with open(os.path.join(SRC, 'locales', 'en.json'), encoding='utf-8') as english_file:
        english_resource = json.load(english_file)
    locale_bundles = {}
    for code, entry in locale_catalog.items():
        if not entry.get('released'):
            continue
        if code != 'en' and not (entry.get('humanReviewedBy') and entry.get('reviewedAt') and all(entry.get('verifiedLayouts', {}).get(platform) for platform in ('web', 'desktop', 'android'))):
            raise ValueError('Locale cannot ship without human review and platform verification: ' + code)
        with open(os.path.join(SRC, 'locales', code + '.json'), encoding='utf-8') as resource_file:
            resource = json.load(resource_file)
        if set(resource) != set(english_resource) or any(not isinstance(value, str) or not value.strip() for value in resource.values()):
            raise ValueError('Locale has missing, extra, or blank translations: ' + code)
        locale_bundles[code] = json.dumps(resource, ensure_ascii=False, separators=(',', ':'))
    subprocess.run(['node', os.path.join(BASE, 'scripts', 'validate-locales.cjs')], check=True)
    localization_js = 'var DAL_LOCALE_CATALOG=' + json.dumps(locale_catalog, ensure_ascii=False) + ';\nvar DAL_LOCALE_BUNDLES=' + json.dumps(locale_bundles, ensure_ascii=False) + ';\n' + localization_js
    assets_ui_js = read_file(os.path.join(SRC, 'assets-ui.js'))
    library_js = read_file(os.path.join(SRC, 'library.js'))
    bundle_js = read_file(os.path.join(SRC, 'bundle.js'))
    navigation_js = read_file(os.path.join(SRC, 'navigation-tools.js'))
    google_backup_js = read_file(os.path.join(SRC, 'google-backup.js'))
    google_auth_js = read_file(os.path.join(SRC, 'google-backup-auth.js'))
    google_backup_ui_js = read_file(os.path.join(SRC, 'google-backup-ui.js'))

    # rpg-engine defines DAL.rpg, which the adventure tools call while rendering,
    # so it has to be in place before adventure-tools.js runs. interaction.js
    # extends the DAL namespace core.js creates and is used by every view.
    # The asset files come last: assets-ui and library decorate DAL.handleClick
    # and DAL.renderPlaytest, so the functions they wrap must already exist.
    all_js = '\n\n'.join([locale_vendor_js, asset_js, core_js, localization_js, native_export_js, interaction_js, views_js, story_js, world_js, continuity_js, encyclopedia_js, world_analysis_js, analytics_js, publishing_js, sync_js, writer_js,
                          rpg_js, adventure_js, native_narration_js, assets_audio_js, assets_ui_js, library_js, bundle_js, voice_js, navigation_js, google_backup_js, google_auth_js, google_backup_ui_js])

    # The export code emits an HTML document containing a literal '</script>'.
    # Left as-is, that string closes the inline <script> block of this build and
    # breaks the whole app, so escape any closing-tag sequence for inlining.
    all_js = all_js.replace('</script', '<\\/script')
    css = css.replace('</style', '<\\/style')

    # The same export code also emits literal '</body></html>'. That is valid
    # inside a <script> block, but it makes the built file contain a false
    # end-of-document marker: any tool that injects content before the last
    # </body></html> (hosting platforms, analytics snippets, live-reload
    # wrappers) will inject it into the middle of our JavaScript instead.
    # Escaping keeps the emitted export byte-identical while removing the trap.
    all_js = all_js.replace('</body', '<\\/body').replace('</html', '<\\/html')

    # Head links, embedded where the asset exists and dropped where it does not,
    # so a missing file never leaves a dead reference in the output.
    head_links = []
    if include_web_metadata:
        for name, size in zip(FAVICON_PNGS, ('32x32', '192x192')):
            uri = icon_uri(name)
            if uri:
                head_links.append(f'<link rel="icon" type="image/png" sizes="{size}" href="{uri}">')
        apple = icon_uri(APPLE_TOUCH)
        if apple:
            head_links.append(f'<link rel="apple-touch-icon" sizes="180x180" href="{apple}">')
        manifest_uri = build_manifest_uri()
        if manifest_uri:
            head_links.append(f'<link rel="manifest" href="{manifest_uri}">')
    head_links = '\n'.join(head_links)
    web_meta = '''<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Draft A Lore">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">''' if include_web_metadata else ''

    return f'''<!DOCTYPE html>
<!--
  Draft A Lore v1.0.0 — created by Daymien Vanhorn
  https://github.com/Hexxis-Studios/Draft-A-Lore
  Copyright 2026 Daymien Vanhorn. Free for noncommercial use under the PolyForm
  Noncommercial License 1.0.0 plus supplemental terms (LICENSE.md). Credit to the
  original author must remain visible in any distributed version. Commercial use
  requires a license — see COMMERCIAL-LICENSE.md.
-->
<html lang="en" data-theme="aurora">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="description" content="Draft A Lore — A writing and RPG adventure design tool. Write novels, build branching narratives, and manage characters and lore, with your work stored on your own device.">
<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#0F1116">
<meta name="application-name" content="Draft A Lore">
<meta http-equiv="Content-Security-Policy" content="connect-src 'self' https://www.googleapis.com https://accounts.google.com https://oauth2.googleapis.com http://127.0.0.1:*; object-src 'none'; base-uri 'none'">
{web_meta}
<title>Draft A Lore</title>
{head_links}
<style>
{css}
</style>
</head>
<body>
<script>
{all_js}
</script>
<script>
if (document.readyState === 'loading') {{
    document.addEventListener('DOMContentLoaded', function() {{ DAL.init(); }});
}} else {{
    DAL.init();
}}
</script>
</body>
</html>'''


def copy_assets(destination, include_icons=True):
    os.makedirs(destination, exist_ok=True)
    for name in DIST_ASSETS:
        source = os.path.join(ASSETS, name)
        if os.path.isfile(source):
            shutil.copy2(source, os.path.join(destination, name))
    icons = os.path.join(ASSETS, 'icons')
    if include_icons and os.path.isdir(icons):
        target = os.path.join(destination, 'icons')
        if os.path.isdir(target):
            shutil.rmtree(target)
        shutil.copytree(icons, target)


def build(copy_release=True):
    html = render_html()

    os.makedirs(DIST, exist_ok=True)
    dist_file = os.path.join(DIST, OUTPUT_NAME)
    with open(dist_file, 'w', encoding='utf-8') as f:
        f.write(html)
    copy_assets(DIST)
    print(f'Built dist/{OUTPUT_NAME} ({len(html):,} bytes)')

    # releases/ is committed so the app can be downloaded and run without a
    # build step. The HTML there is fully self-contained; the .ico ships beside
    # it only because the Windows shortcut needs an icon file on disk.
    if copy_release:
        os.makedirs(RELEASES, exist_ok=True)
        shutil.copy2(dist_file, os.path.join(RELEASES, OUTPUT_NAME))
        favicon = os.path.join(ASSETS, 'favicon.ico')
        if os.path.isfile(favicon):
            shutil.copy2(favicon, os.path.join(RELEASES, 'favicon.ico'))
        print(f'Copied to releases/{OUTPUT_NAME}')


if __name__ == '__main__':
    build('--no-release' not in sys.argv[1:])
