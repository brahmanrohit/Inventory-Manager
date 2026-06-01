// Reusable cinematic 3D background.
//   variant="cinema" (default) → full old-movie treatment: letterbox bars + flicker.
//   variant="app"             → calmer version for the working app (no bars/flicker).
export default function CinematicBackground({ variant = "cinema" }) {
  const app = variant === "app";
  return (
    <div className={`cinema-bg ${app ? "cinema-bg--app" : ""}`} aria-hidden="true">
      <div className="cinema-gradient" />

      <div className="cinema-scene">
        <div className="shape shape-cube s1">
          <span className="face f-front" /><span className="face f-back" />
          <span className="face f-right" /><span className="face f-left" />
          <span className="face f-top" /><span className="face f-bottom" />
        </div>
        <div className="shape shape-cube s2">
          <span className="face f-front" /><span className="face f-back" />
          <span className="face f-right" /><span className="face f-left" />
          <span className="face f-top" /><span className="face f-bottom" />
        </div>
        <div className="shape shape-ring s3" />
        <div className="shape shape-ring s4" />
        <div className="shape shape-orb s5" />
      </div>

      <div className="cinema-scanlines" />
      <div className="cinema-grain" />
      <div className="cinema-vignette" />

      {!app && <div className="cinema-flicker" />}
      {!app && <div className="cinema-bar top" />}
      {!app && <div className="cinema-bar bottom" />}
    </div>
  );
}
