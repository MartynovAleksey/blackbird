import { createMemo, For, Show } from "solid-js"
import { Icon } from "@opencode/ui/icon"
import { IconButton } from "@opencode/ui/icon-button"
import { Menu } from "@opencode/ui/menu"
import { Tooltip } from "@opencode/ui/tooltip"
import { useLanguage } from "@/runtime/i18n/language"
import { createSessionPanelMenuEntries } from "@/runtime/plugin/panel-menu"
import { useSessionLayout } from "@/session/session-layout"
import { useCommand } from "@/shell/commands/command"
import { useSettings } from "@/settings/model"

// Claude Code's order: Session, Terminal, Changes, Browser, Files. Launchers of other plugins follow.
const ORDER = ["details", "terminal", "review", "browser", "file"]

const rank = (key: string) => {
  const index = ORDER.indexOf(key.split(":")[0])

  return index === -1 ? ORDER.length : index
}

/**
 * blackbird: the Native layout's tool row above the side panel, like Claude Code's. Its tools are the plugins' own
 * launchers from the side panel's + menu, so a tool appears only where its plugin offers it (the browser only on
 * desktop).
 */
export function NativeRail(props: {
  bottomTabs: () => boolean
  bottomShown: () => boolean
  ref?: (element: HTMLElement) => void
}) {
  const language = useLanguage()
  const settings = useSettings()
  const command = useCommand()
  const launchers = createSessionPanelMenuEntries()
  const entries = createMemo(() => launchers().toSorted((a, b) => rank(a.key) - rank(b.key)))
  const { view, tabs } = useSessionLayout()

  // Tab keys and launcher keys both start with the plugin's id, e.g. `review:changes` and `review:open`.
  const active = (key: string) => view().side.opened() && tabs().active()?.split(":")[0] === key.split(":")[0]

  // The terminal's launcher adds a terminal on every click; its own toggle shows and hides the open one instead.
  const run = (key: string, item: { run: () => void }) => {
    if (active(key)) return view().side.toggle()

    if (key === "terminal:new") return command.trigger("terminal.toggle")

    item.run()
  }

  return (
    <nav
      ref={props.ref}
      data-component="native-rail"
      aria-label={language.t("native.rail.title")}
      class="flex h-12 shrink-0 items-center gap-0.5"
    >
      <For each={entries()}>
        {(entry) => (
          <Tooltip placement="bottom" value={entry.item.title}>
            <IconButton
              type="button"
              variant="ghost-muted"
              size="large"
              icon={<Icon name={entry.item.icon ?? "plus"} />}
              state={active(entry.key) ? "pressed" : undefined}
              aria-pressed={active(entry.key)}
              aria-label={entry.item.title}
              onClick={() => run(entry.key, entry.item)}
            />
          </Tooltip>
        )}
      </For>
      <Menu modal={false} placement="bottom-end">
        <Tooltip placement="bottom" value={language.t("native.rail.view")}>
          <Menu.Trigger
            as={IconButton}
            type="button"
            variant="ghost-muted"
            size="large"
            icon={<Icon name="outline-dots" />}
            aria-label={language.t("native.rail.view")}
          />
        </Tooltip>
        <Menu.Portal>
          <Menu.Content>
            <Menu.CheckboxItem
              checked={settings.appearance.sidebarOpen()}
              onChange={(checked) => settings.appearance.setSidebarOpen(checked)}
            >
              {language.t("native.rail.sessions")}
            </Menu.CheckboxItem>
            <Menu.CheckboxItem checked={view().side.opened()} onChange={() => view().side.toggle()}>
              {language.t("native.rail.side")}
            </Menu.CheckboxItem>
            {/* The bottom pane exists only while it holds tabs; until then there is nothing to show or hide. */}
            <Show when={props.bottomTabs()}>
              <Menu.CheckboxItem
                checked={props.bottomShown()}
                onChange={(checked) => view().bottom.setOpened(checked)}
              >
                {language.t("session.panel.bottom")}
              </Menu.CheckboxItem>
            </Show>
          </Menu.Content>
        </Menu.Portal>
      </Menu>
    </nav>
  )
}
