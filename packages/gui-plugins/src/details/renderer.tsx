import { lazy, onCleanup, Show, Suspense } from "solid-js"
import { MenuItem, Panel, Slot, Style, usePanel, type MenuItem as MenuItemValue, type PanelTab, type Plugin } from "@opencode/plugin/gui"
import type Details from "./index"
import { DetailsHeader, type DetailsMenus } from "./popover"
import { BuiltinSlot, onIdle } from "@opencode/plugin/gui/builtin"
import type { McpControllers } from "./server-panel"
import type { WorkspaceMoveControllers } from "./workspace-menu"

const setup: Plugin.Setup<typeof Details> = (ctx) => {
  const sessions = ctx.sessions

  const menus: DetailsMenus = new Set()
  // MCP toggles and error dialogs outlive the popover or drawer that started them.
  const mcp: McpControllers = new Map()
  // Moves and their recovery dialogs outlive the location menu, which closes when the user picks a destination.
  const moves: WorkspaceMoveControllers = new Map()

  const DetailsPanel = lazy(() =>
    Promise.all([import("./panel"), import("./details.css?inline")]).then(([panel, css]) => {
      ctx.add(Style, css.default)

      return panel
    }),
  )

  const LocationMenu = lazy(() => import("./location-menu"))
  const LocationWorkspace = lazy(() => import("./location-workspace"))

  // Compile the panel while the app idles, so the first open renders at once.
  onCleanup(
    onIdle(() => {
      void DetailsPanel.preload()
      void LocationMenu.preload()
      void LocationWorkspace.preload()
    }),
  )

  ctx.add(Slot, {
    at: "session.header",
    order: 20,
    render: (input) => (
      <DetailsHeader menus={menus} session={input.session} active={input.active} panel={DetailsPanel} mcp={mcp} />
    ),
  })

  ctx.add(Slot, {
    at: "session.location.menu",
    render: (input) => (
      <Suspense>
        <LocationMenu session={input.session} screen={input.screen} shown={input.shown} />
      </Suspense>
    ),
  })

  ctx.add(BuiltinSlot, {
    at: "session.location.workspace",
    render: (input) => (
      <Suspense>
        <LocationWorkspace {...input} moves={moves} />
      </Suspense>
    ),
  })

  // blackbird: the details also open as a side tab, the Session tab of the Native layout's tool rail.
  const tab: PanelTab = {
    id: "main",
    get title() {
      return ctx.t("title")
    },
  }

  // The narrow-screen details drawer, offered for sessions of a project, subagents included.
  const panel: Panel = {
    id: "main",
    region: "side",
    mobile: {
      get title() {
        return ctx.t("title")
      },
      order: 50,
      kind: "drawer",
      icon: "info",
    },
    list: (input) => (input.open.includes("main") ? [tab] : []),
    render: (props) => {
      const frame = usePanel()

      return (
        <Show when={props.session.project}>
          <Suspense>
            <DetailsPanel
              mobile={frame.placement() === "mobile"}
              fill={frame.placement() !== "mobile"}
              shown={frame.visible()}
              session={props.session}
              mcp={mcp}
            />
          </Suspense>
        </Show>
      )
    },
  }

  ctx.add(MenuItem, (): MenuItemValue | undefined => {
    const session = sessions.current()

    if (!session?.project || ctx.layout.narrow()) return

    return {
      menu: "session.panel",
      id: "main",
      title: ctx.t("title"),
      icon: "bullet-list",
      order: 5,
      opened: ctx.layout.state(`${ctx.id}:main`, session) !== "closed",
      run: () => ctx.layout.open(`${ctx.id}:main`, session),
    }
  })

  ctx.add(Panel, () => {
    const session = sessions.current()

    if (!session?.project) return

    return panel
  })
}

export default setup
