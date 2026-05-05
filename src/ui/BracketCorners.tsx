/**
 * Sci-fi corner brackets for `.panel`. Drop in as the first child:
 *
 *   <div className="panel relative">
 *     <BracketCorners />
 *     ...
 *   </div>
 *
 * Inherits its color from the parent panel variant (cyan by default,
 * magenta under `.panel--magenta`).
 */
export default function BracketCorners() {
  return (
    <>
      <span className="bracket bracket--tl" aria-hidden />
      <span className="bracket bracket--tr" aria-hidden />
      <span className="bracket bracket--bl" aria-hidden />
      <span className="bracket bracket--br" aria-hidden />
    </>
  );
}
