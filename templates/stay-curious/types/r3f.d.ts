import type { ThreeElements } from "@react-three/fiber";

declare module "react" {
  namespace JSX {
    // Declaration merging needs an interface that only extends ThreeElements —
    // a type alias cannot augment JSX.IntrinsicElements, so the body stays empty.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface IntrinsicElements extends ThreeElements {}
  }
}
