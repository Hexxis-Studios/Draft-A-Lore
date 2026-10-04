import unittest
import json
import re
from pathlib import Path

from build import render_html


ROOT = Path(__file__).resolve().parents[1]


class BuildOutputTests(unittest.TestCase):
    def test_optional_google_backup_is_shared_and_not_automatically_connected(self):
        for metadata in (True, False):
            html = render_html(include_web_metadata=metadata)
            for marker in ('DAL.GoogleBackupClient=function', 'DAL.googleBackupPlatform=function', 'Optional Google backup', 'google-restore-copy'):
                self.assertIn(marker, html)
            self.assertNotIn('<script src="https://accounts.google.com/gsi/client"', html)

    def test_offline_policy_matches_the_complete_public_policy(self):
        source = (ROOT / 'privacy-policy.html').read_text(encoding='utf-8')
        expected = re.search(r'<main>([\s\S]*?)</main>', source).group(1)
        for metadata in (True, False):
            html = render_html(include_web_metadata=metadata)
            actual = json.loads(re.search(r'window.DAL_PRIVACY_CONTENT=("(?:\\.|[^"\\])*");', html).group(1))
            self.assertEqual(actual, expected)
            self.assertIn('Optional dictation and read aloud', actual)

    def test_mobile_keeps_runtime_logo_without_web_install_metadata(self):
        html = render_html(include_web_metadata=False)
        self.assertIn('window.DAL_ASSETS={"logo":"data:image/png;base64,', html)
        self.assertNotIn('rel="manifest"', html)
        self.assertNotIn('rel="apple-touch-icon"', html)
        self.assertNotIn('rel="icon"', html)
        self.assertNotIn('apple-mobile-web-app-capable', html)

    def test_web_keeps_install_metadata(self):
        html = render_html()
        self.assertIn('rel="manifest"', html)
        self.assertIn('rel="apple-touch-icon"', html)
        self.assertIn('rel="icon"', html)

    def test_mobile_and_web_share_the_same_application(self):
        web = render_html()
        mobile = render_html(include_web_metadata=False)
        self.assertEqual(web.split('<style>', 1)[1], mobile.split('<style>', 1)[1])

    def test_author_name_uses_the_brand_animation(self):
        html = render_html(include_web_metadata=False)
        self.assertIn('profile-name brand-text', html)
        self.assertNotIn(':root[data-theme] .profile-name{', html)

    def test_voice_and_navigation_workflows_are_in_both_builds(self):
        for web_metadata in (True, False):
            with self.subTest(web_metadata=web_metadata):
                html = render_html(include_web_metadata=web_metadata)
                for marker in ('DAL.showDictation = function',
                               'DAL.matchesToolQuery=function',
                               'projectToolSearch',
                               'Manuscript formatting tools',
                               'dictationInsertionText'):
                    self.assertTrue(marker in html, f'Missing bundled workflow: {marker}')
                self.assertTrue('id="projectToolSearch"' in html or 'id=\\"projectToolSearch\\"' in html,
                                'Missing project section search control')

    def test_generated_html_matches_current_sources(self):
        expected = render_html()
        for folder in ('dist', 'releases'):
            with self.subTest(folder=folder):
                actual = (ROOT / folder / 'DraftALore.html').read_text(encoding='utf-8')
                self.assertEqual(actual, expected)

    def test_all_themes_use_aurora_typography(self):
        css = (ROOT / 'src' / 'styles.css').read_text(encoding='utf-8')
        self.assertEqual(css.count('--font-display:'), 1)
        self.assertEqual(css.count('--font-body:'), 1)
        self.assertEqual(css.count('--font-mono:'), 1)
        self.assertIn("--font-display:'Cinzel','Georgia','Cambria',serif", css)

    def test_android_webview_applies_system_and_cutout_insets(self):
        source = (ROOT / 'android' / 'app' / 'src' / 'main' / 'java' /
                  'com' / 'draftalore' / 'app' / 'MainActivity.java').read_text(encoding='utf-8')
        self.assertIn('WindowInsetsCompat.Type.systemBars()', source)
        self.assertIn('WindowInsetsCompat.Type.displayCutout()', source)
        self.assertIn('WindowInsetsCompat.Type.ime()', source)
        self.assertIn('Math.max(safeArea.bottom, keyboard.bottom)', source)
        self.assertIn('layout.setMargins(safeArea.left, safeArea.top, safeArea.right, bottom)', source)
        self.assertIn('view.setLayoutParams(layout)', source)
        self.assertIn('return WindowInsetsCompat.CONSUMED', source)
        self.assertIn('SOFT_INPUT_ADJUST_NOTHING', source)
        self.assertNotIn('view.setPadding(safeArea.left', source)

    def test_native_insets_have_one_owner_and_config_is_synchronized(self):
        config = json.loads((ROOT / 'capacitor.config.json').read_text(encoding='utf-8'))
        self.assertEqual(config['plugins']['SystemBars']['insetsHandling'], 'disable')
        staged = json.loads((ROOT / 'android/app/src/main/assets/capacitor.config.json').read_text(encoding='utf-8'))
        self.assertEqual(staged, config)

    def test_native_printing_discloses_custom_paper_limit_before_opening_dialog(self):
        source = (ROOT / 'android' / 'app' / 'src' / 'main' / 'java' /
                  'com' / 'draftalore' / 'app' / 'BookPrintPlugin.java').read_text(encoding='utf-8')
        self.assertIn('delegate.onLayout(oldAttributes, newAttributes', source)
        html = render_html(include_web_metadata=False)
        self.assertIn('Android may replace a custom book size with a standard paper size', html)
        self.assertIn('nativeBookPdfHelp', html)
        self.assertNotIn('fixedBookSize:true', html)

    def test_native_export_accepts_json_integer_sizes_and_offsets(self):
        source = (ROOT / 'android' / 'app' / 'src' / 'main' / 'java' /
                  'com' / 'draftalore' / 'app' / 'FileExportPlugin.java').read_text(encoding='utf-8')
        self.assertIn('Integer size = call.getInt("size")', source)
        self.assertIn('Integer offset = call.getInt("offset")', source)
        self.assertIn('256L * 1024 * 1024', source)
        self.assertIn('offset != written', source)
        self.assertNotIn('call.getLong(', source)

    def test_compact_toolbars_preserve_safe_area_and_folder_access(self):
        html = render_html()
        self.assertIn('padding-top:calc(4px + var(--safe-t))', html)
        self.assertIn('padding-top:calc(2px + var(--safe-t))', html)
        self.assertIn("label: 'Link or change project folder…', labelKey: 'menu_link_folder', action: 'link-folder'", html)

    def test_focus_mode_keeps_a_touch_exit_and_hides_chapter_accessories(self):
        html = render_html()
        self.assertIn('class="btn focus-exit-button" data-action="fullscreen">', html)
        self.assertIn("text('exitFocusMode','Exit Focus Mode')", html)
        self.assertIn('.distraction-free .focus-exit-button{display:block', html)
        self.assertIn('.distraction-free .panel:has([data-panel="audio-bind-chapter"]){display:none!important}', html)


if __name__ == "__main__":
    unittest.main()
