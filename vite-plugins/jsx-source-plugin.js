import { relative } from 'node:path'

/** 为开发环境中的原生 JSX 标签添加源码位置属性 */
export default function jsxSourcePlugin({ types: t }, { rootDir }) {
  return {
    name: 'jsx-source-plugin',
    visitor: {
      JSXOpeningElement(nodePath, state) {
        const node = nodePath.node
        const name = node.name

        if (!t.isJSXIdentifier(name) || !/^[a-z]/.test(name.name)) return
        if (node.attributes.some((attribute) => (
          t.isJSXAttribute(attribute)
          && t.isJSXIdentifier(attribute.name, { name: 'data-source' })
        ))) return

        const filename = state.filename
        if (!filename || !node.loc) return

        const file = relative(rootDir, filename).replace(/\\/g, '/')
        const { line, column } = node.loc.start

        node.attributes.push(
          t.jsxAttribute(
            t.jsxIdentifier('data-source'),
            t.stringLiteral(`${file}:${line}:${column + 1}`),
          ),
        )
      },
    },
  }
}
