import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';

/**
 * Remark plugin that unescapes markdown characters mangled by Sveltia CMS.
 * The CMS escapes backticks, asterisks, underscores, and brackets on save.
 * This runs first in the pipeline so downstream plugins see clean markdown.
 */
export function remarkUnescape() {
  return (tree: Root) => {
    visit(tree, 'text', (node: any) => {
      if (typeof node.value === 'string') {
        node.value = node.value
          .replace(/\\`/g, '`')
          .replace(/\\\*/g, '*')
          .replace(/\\_/g, '_')
          .replace(/\\\[/g, '[')
          .replace(/\\\]/g, ']');
      }
    });
  };
}
