import { lazy, Suspense, type ComponentProps } from "react";
const ServiceRoom = lazy(() => import("./ServiceRoom"));

export default function RoomPreview(props: ComponentProps<typeof ServiceRoom>) {
  return <Suspense fallback={<p role="status" className="p-4">Opening the 3D view…</p>}>
    <ServiceRoom {...props} />
  </Suspense>;
}
