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

// blackbird: the pixel wordmark from the TUI logo (packages/tui/src/logo.ts) on a 6px grid, "black" muted and
// "bird" strong like opencode's "open" and "code".
export const Logo = (props: { class?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 228 36"
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <path d="M6 18H18V24H6ZM78 18H96V24H78ZM6 24H18V30H6ZM78 24H96V30H78Z" fill="var(--icon-weak-base)" />
      <path
        d="M0 0H6V6H0ZM30 0H36V6H30ZM102 0H108V6H102ZM0 6H24V12H0ZM30 6H36V12H30ZM42 6H66V12H42ZM72 6H96V12H72ZM102 6H108V12H102ZM120 6H126V12H120ZM0 12H6V18H0ZM18 12H24V18H18ZM30 12H36V18H30ZM60 12H66V18H60ZM72 12H78V18H72ZM102 12H108V18H102ZM114 12H120V18H114ZM0 18H6V24H0ZM18 18H24V24H18ZM30 18H36V24H30ZM42 18H66V24H42ZM72 18H78V24H72ZM102 18H114V24H102ZM0 24H6V30H0ZM18 24H24V30H18ZM30 24H36V30H30ZM42 24H48V30H42ZM60 24H66V30H60ZM72 24H78V30H72ZM102 24H108V30H102ZM114 24H120V30H114ZM0 30H24V36H0ZM30 30H36V36H30ZM42 30H66V36H42ZM72 30H96V36H72ZM102 30H108V36H102ZM120 30H126V36H120Z"
        fill="var(--icon-base)"
      />
      <path
        d="M138 18H150V24H138ZM210 18H222V24H210ZM138 24H150V30H138ZM210 24H222V30H210Z"
        fill="var(--icon-weak-base)"
      />
      <path
        d="M132 0H138V6H132ZM222 0H228V6H222ZM132 6H156V12H132ZM162 6H168V12H162ZM174 6H198V12H174ZM204 6H228V12H204ZM132 12H138V18H132ZM150 12H156V18H150ZM174 12H180V18H174ZM204 12H210V18H204ZM222 12H228V18H222ZM132 18H138V24H132ZM150 18H156V24H150ZM162 18H168V24H162ZM174 18H180V24H174ZM204 18H210V24H204ZM222 18H228V24H222ZM132 24H138V30H132ZM150 24H156V30H150ZM162 24H168V30H162ZM174 24H180V30H174ZM204 24H210V30H204ZM222 24H228V30H222ZM132 30H156V36H132ZM162 30H168V36H162ZM174 30H180V36H174ZM204 30H228V36H204Z"
        fill="var(--icon-strong-base)"
      />
    </svg>
  )
}
