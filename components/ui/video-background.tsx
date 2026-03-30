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
      <div className="fixed inset-0 bg-black/35 z-[1]" />
      <div className="fixed inset-0 z-[2] bg-[radial-gradient(circle_at_top,rgba(176,108,255,0.14),transparent_55%)]" />
    </>
  )
}
