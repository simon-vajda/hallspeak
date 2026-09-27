import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';
import starlightLinksValidator from 'starlight-links-validator';

export default defineConfig({
  site: 'https://hallspeak.app',
  integrations: [
    starlight({
      title: 'Hallspeak',
      description:
        'Self-hosted simultaneous interpretation for live, in-person events. Listeners hear the interpreter on their own phones.',
      logo: { src: './src/assets/logo-mark.svg' },
      favicon: '/favicon.svg',
      head: [
        {
          tag: 'link',
          attrs: { rel: 'icon', type: 'image/png', href: '/favicon-96x96.png', sizes: '96x96' },
        },
        { tag: 'link', attrs: { rel: 'shortcut icon', href: '/favicon.ico' } },
        {
          tag: 'link',
          attrs: { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:image', content: 'https://hallspeak.app/og-image.png' },
        },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1280' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        { tag: 'meta', attrs: { property: 'og:image:alt', content: 'Hallspeak' } },
        {
          tag: 'meta',
          attrs: { name: 'twitter:image', content: 'https://hallspeak.app/og-image.png' },
        },
      ],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/simon-vajda/hallspeak' },
      ],
      customCss: ['./src/styles/theme.css'],
      plugins: [starlightLinksValidator()],
      sidebar: [
        {
          label: 'Getting started',
          items: [
            'getting-started/installation',
            'getting-started/hosting',
            'getting-started/upgrading-and-troubleshooting',
          ],
        },
        'privacy',
      ],
    }),
  ],
});
