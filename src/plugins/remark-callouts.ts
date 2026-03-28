import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';

const CONTAINER_DIRECTIVES = new Set(['note', 'warning', 'tldr', 'diagram']);

export function remarkCallouts() {
  return (tree: Root) => {
    visit(tree, (node: any) => {
      if (node.type === 'containerDirective' && CONTAINER_DIRECTIVES.has(node.name)) {
        const data = node.data || (node.data = {});
        data.hName = 'div';
        data.hProperties = { class: `directive directive-${node.name}` };

        if (node.name === 'tldr') {
          node.children.unshift({
            type: 'paragraph',
            data: { hName: 'div', hProperties: { class: 'directive-tldr-label' } },
            children: [{ type: 'text', value: 'tl;dr' }],
          });
        }

        if (node.name === 'diagram') {
          // Extract label from :::diagram[Label]
          const labelNode = node.children.find((c: any) => c.data?.directiveLabel);
          const label = labelNode?.children?.[0]?.value || '';

          // Rebuild children
          const newChildren: any[] = [];

          if (label) {
            newChildren.push({
              type: 'paragraph',
              data: { hName: 'div', hProperties: { class: 'diagram-label' } },
              children: [{ type: 'text', value: label }],
            });
          }

          for (const child of node.children) {
            if (child.data?.directiveLabel) continue;
            if (child.type === 'paragraph') {
              const text = child.children?.map((c: any) => c.value || '').join('') || '';
              if (text.includes('→')) {
                const steps = text.split('→').map((s: string) => s.trim()).filter(Boolean);
                const flowChildren: any[] = [];
                steps.forEach((step: string, i: number) => {
                  flowChildren.push({
                    type: 'paragraph',
                    data: { hName: 'span', hProperties: { class: 'diagram-box' } },
                    children: [{ type: 'text', value: step }],
                  });
                  if (i < steps.length - 1) {
                    flowChildren.push({
                      type: 'paragraph',
                      data: { hName: 'span', hProperties: { class: 'diagram-arrow' } },
                      children: [{ type: 'text', value: '→' }],
                    });
                  }
                });
                newChildren.push({
                  type: 'paragraph',
                  data: { hName: 'div', hProperties: { class: 'diagram-flow' } },
                  children: flowChildren,
                });
              } else {
                newChildren.push(child);
              }
            } else {
              newChildren.push(child);
            }
          }

          node.children = newChildren;
        }
      }

      // Leaf directives
      if (node.type === 'leafDirective') {
        if (node.name === 'codelabel') {
          const data = node.data || (node.data = {});
          data.hName = 'div';
          data.hProperties = { class: 'directive-codelabel' };
        }
        if (node.name === 'sep') {
          const data = node.data || (node.data = {});
          data.hName = 'div';
          data.hProperties = { class: 'directive-sep' };
          node.children = [{ type: 'text', value: '* * *' }];
        }
      }
    });
  };
}
