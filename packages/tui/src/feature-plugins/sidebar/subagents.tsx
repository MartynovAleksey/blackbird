import { Plugin } from "@opencode/plugin/tui"
import { createMemo, For, Show } from "solid-js"

// blackbird: running subagents of the open session family; a click opens the subagent session.
export function SidebarSubagents(props: { context: Plugin.Context; sessionID: string }) {
  const theme = props.context.theme
  const session = props.context.data.session
  const list = createMemo(() => {
    const root = session.root(props.sessionID)
    return session
      .family(root)
      .filter((id) => id !== root && session.status(id) === "running")
      .flatMap((id) => session.get(id) ?? [])
  })

  return (
    <Show when={list().length > 0}>
      <box>
        <text fg={theme.text.base}>
          <b>Subagents</b>
          <span style={{ fg: theme.text.muted }}> ({list().length} running)</span>
        </text>
        <For each={list()}>
          {(item) => (
            <box
              flexDirection="row"
              gap={1}
              minWidth={0}
              onMouseUp={() => props.context.ui.router.navigate({ type: "session", sessionID: item.id })}
            >
              <text flexShrink={0} fg={theme.text.feedback.success.base}>
                •
              </text>
              <text
                fg={item.id === props.sessionID ? theme.text.muted : theme.text.base}
                wrapMode="none"
                truncate
                flexGrow={1}
                flexShrink={1}
                minWidth={0}
              >
                {item.title}
              </text>
            </box>
          )}
        </For>
      </box>
    </Show>
  )
}

export default Plugin.define({
  id: "blackbird.sidebar.subagents",
  setup(context) {
    context.ui.slot({
      append: "sidebar.content",
      render: (props) => <SidebarSubagents context={context} sessionID={props.sessionID} />,
    })
  },
})
