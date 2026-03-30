"use client"

export function VideoBackground() {
  return (
    <>
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        className="fixed inset-0 w-full h-full object-cover z-0"
        src="/demo_720P.mp4"
      />
      <div className="fixed inset-0 bg-black/50 z-[1]" />
    </>
  )
}
