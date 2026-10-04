const FIELD = '\x1f';

export const LOG_FORMAT = ['%H', '%an', '%s'].join('%x1f');

export function parseLog(output) {
  return output
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => {
      const [sha, authorName, subject] = line.split(FIELD);
      return { sha, authorName, subject };
    });
}

export function prNumber(subject) {
  const match = /\(#(\d+)\)\s*$/.exec(subject);
  return match ? Number(match[1]) : null;
}

export function formatAuthor(author) {
  if (author.is_bot) {
    return `@${author.login.replace(/^app\//, '')}[bot]`;
  }
  return `@${author.login}`;
}

export function renderMarkdown(entries, { repo, from, tag }) {
  const lines = ["## What's Changed"];
  for (const entry of entries) {
    lines.push(`* ${entry.title} by ${entry.author} in ${entry.url ?? entry.sha.slice(0, 7)}`);
  }
  if (from && tag) {
    lines.push('', `**Full Changelog**: https://github.com/${repo}/compare/${from}...${tag}`);
  }
  return `${lines.join('\n')}\n`;
}
