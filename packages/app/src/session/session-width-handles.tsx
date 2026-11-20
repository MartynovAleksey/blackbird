import { Show } from "solid-js"
import { ResizeHandle } from "@opencode/ui/resize-handle"
import { useSettings } from "@/settings/model"

const MIN = 400

/**
 * Handles on both edges of the session column while the timeline width is "custom": dragging either one resizes the
 * centred column, so it grows by twice the pointer's travel.
 */
export function SessionWidthHandles() {
  const settings = useSettings()
  let frame: HTMLDivElement | undefined
  const half = () => settings.general.timelineCustomWidth() / 2
  // The column never outgrows the panel it sits in.
  const max = () => Math.max(MIN, frame?.parentElement?.clientWidth ?? 4000) / 2
  const resize = (size: number) => settings.general.setTimelineCustomWidth(size * 2)

  return (
    <Show when={settings.general.timelineWidth() === "custom"}>
      <div
        ref={frame}
        data-component="session-width-handles"
        class="pointer-events-none absolute inset-y-0 start-1/2 z-[75] hidden max-w-full -translate-x-1/2 md:block rtl:translate-x-1/2"
        style={{ width: "var(--container-session)" }}
      >
        <ResizeHandle
          class="pointer-events-auto"
          direction="horizontal"
          edge="start"
          size={half()}
          min={MIN / 2}
          max={max()}
          onResize={resize}
        />
        <ResizeHandle
          class="pointer-events-auto"
          direction="horizontal"
          edge="end"
          size={half()}
          min={MIN / 2}
          max={max()}
          onResize={resize}
        />
      </div>
    </Show>
  )
}
