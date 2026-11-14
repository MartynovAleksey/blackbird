import { type ComponentProps } from "solid-js"
import blackbirdMark from "../assets/images/blackbird-mark.png"

// blackbird: the mark and splash show the blackbird icon instead of the opencode "O".
export const Mark = (props: { class?: string }) => {
  return (
    <img
      data-component="logo-mark"
      classList={{ [props.class ?? ""]: !!props.class }}
      src={blackbirdMark}
      alt=""
      draggable={false}
    />
  )
}

export const Splash = (props: Pick<ComponentProps<"img">, "ref" | "class">) => {
  return (
    <img
      ref={props.ref}
      data-component="logo-splash"
      classList={{ [props.class ?? ""]: !!props.class }}
      src={blackbirdMark}
      alt=""
      draggable={false}
    />
  )
}

// blackbird: the wordmark is the mark plus the name, in the opencode wordmark's 234×42 box so callers keep their sizing.
export const Logo = (props: { class?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 234 42"
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <image href={blackbirdMark} x="0" y="0" width="42" height="42" />
      <text x="50" y="32" font-size="34" font-weight="600" letter-spacing="-0.5" fill="var(--icon-strong-base)">
        blackbird
      </text>
    </svg>
  )
}
