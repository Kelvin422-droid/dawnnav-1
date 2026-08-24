(function () {
    'use strict';

    var storageKey = 'dawnnav-sidebar-language';
    var supportedLanguages = ['zh', 'en'];

    function getSavedLanguage() {
        try {
            var savedLanguage = window.localStorage.getItem(storageKey);
            return supportedLanguages.indexOf(savedLanguage) !== -1 ? savedLanguage : 'zh';
        } catch (error) {
            return 'zh';
        }
    }

    function saveLanguage(language) {
        try {
            window.localStorage.setItem(storageKey, language);
        } catch (error) {
            // The switch still works when browser storage is unavailable.
        }
    }

    function applyLanguage(language, shouldSave) {
        var nextLanguage = supportedLanguages.indexOf(language) !== -1 ? language : 'zh';
        var labels = document.querySelectorAll(
            '[data-sidebar-label-zh][data-sidebar-label-en], [data-language-label-zh][data-language-label-en]'
        );
        var translatedTitles = document.querySelectorAll('[data-language-title-zh][data-language-title-en]');
        var switches = document.querySelectorAll('[data-sidebar-language-switch]');

        Array.prototype.forEach.call(labels, function (label) {
            var chineseLabel = label.getAttribute('data-language-label-zh');
            var englishLabel = label.getAttribute('data-language-label-en');

            if (chineseLabel === null || englishLabel === null) {
                chineseLabel = label.getAttribute('data-sidebar-label-zh');
                englishLabel = label.getAttribute('data-sidebar-label-en');
            }

            label.textContent = nextLanguage === 'en'
                ? englishLabel
                : chineseLabel;
            label.setAttribute('lang', nextLanguage === 'en' ? 'en' : 'zh-CN');
        });

        Array.prototype.forEach.call(translatedTitles, function (element) {
            var translatedTitle = element.getAttribute(
                nextLanguage === 'en' ? 'data-language-title-en' : 'data-language-title-zh'
            );

            element.setAttribute('title', translatedTitle);
            element.setAttribute('data-original-title', translatedTitle);
        });

        document.documentElement.setAttribute('lang', nextLanguage === 'en' ? 'en' : 'zh-CN');

        Array.prototype.forEach.call(switches, function (languageSwitch) {
            languageSwitch.setAttribute('data-current-language', nextLanguage);

            Array.prototype.forEach.call(languageSwitch.querySelectorAll('[data-language]'), function (button) {
                var isActive = button.getAttribute('data-language') === nextLanguage;
                button.classList.toggle('is-active', isActive);
                button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
        });

        if (shouldSave) {
            saveLanguage(nextLanguage);
        }

        if (typeof window.CustomEvent === 'function') {
            document.dispatchEvent(new CustomEvent('dawnnav:languagechange', {
                detail: { language: nextLanguage }
            }));
        }
    }

    function initialiseLanguageSwitch() {
        var switches = document.querySelectorAll('[data-sidebar-language-switch]');

        Array.prototype.forEach.call(switches, function (languageSwitch) {
            languageSwitch.addEventListener('click', function (event) {
                var button = event.target.closest('[data-language]');

                if (button && languageSwitch.contains(button)) {
                    applyLanguage(button.getAttribute('data-language'), true);
                }
            });
        });

        applyLanguage(getSavedLanguage(), false);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialiseLanguageSwitch);
    } else {
        initialiseLanguageSwitch();
    }
}());
