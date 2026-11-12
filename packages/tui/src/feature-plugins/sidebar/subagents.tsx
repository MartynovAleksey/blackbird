import type { TuiPlugin, TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { BuiltinTuiPlugin } from "../builtins"
import { createMemo, For, Show } from "solid-js"

const id = "internal:sidebar-subagents"

// blackbird: running subagents of the open session (or its parent); a click opens the subagent session.
function View(props: { api: TuiPluginApi; session_id: string }) {
  const theme = () => props.api.theme.current
  const state = props.api.state
  const list = createMemo(() => {
    const root = state.session.get(props.session_id)?.parentID ?? props.session_id
    // The plugin API has no session list, so children come from the task tool calls of the parent.
    return state.session
      .messages(root)
      .flatMap((message) => state.part(message.id))
      .flatMap((part) => {
        if (part.type !== "tool" || part.tool !== "task" || part.state.status === "pending") return []
        const child = part.state.metadata?.sessionId
        if (typeof child !== "string") return []
        const type = state.session.status(child)?.type
        if (!type || type === "idle") return []
        return state.session.get(child) ?? []
      })
  })

  return (
    <Show when={list().length > 0}>
      <box>
        <text fg={theme().text}>
          <b>Subagents</b>
          <span style={{ fg: theme().textMuted }}> ({list().length} running)</span>
        </text>
        <For each={list()}>
          {(item) => (
            <box
              flexDirection="row"
              gap={1}
              onMouseUp={() => props.api.route.navigate("session", { sessionID: item.id })}
            >
              <text flexShrink={0} fg={theme().success}>
                •
              </text>
              <text fg={item.id === props.session_id ? theme().textMuted : theme().text} wrapMode="none">
                {item.title}
              </text>
            </box>
          )}
        </For>
      </box>
    </Show>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 450,
    slots: {
      sidebar_content(_ctx, props) {
        return <View api={api} session_id={props.session_id} />
      },
    },
  })
}

const plugin: BuiltinTuiPlugin = {
  id,
  tui,
}

export default plugin
