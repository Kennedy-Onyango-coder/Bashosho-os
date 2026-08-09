import React from "react";
import { motion, useScroll, useTransform, useSpring, useInView, AnimatePresence } from "motion/react";

/**
 * Reveal — wraps a section/block and animates it in (fade + rise, with an optional
 * scale/rotate flourish for the "bold & cinematic" style) the first time it scrolls
 * into view. One <Reveal> per section is enough to give the whole page a consistent
 * scroll-triggered rhythm without hand-animating every element inside it.
 */
export function Reveal({
  children,
  delay = 0,
  y = 40,
  className = "",
  cinematic = true
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  cinematic?: boolean;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, scale: cinematic ? 0.97 : 1 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** RevealStagger — parent for a grid/row of cards; each direct <RevealItem> child
 *  cascades in with a small delay after the previous one. */
export function RevealStagger({ children, className = "", staggerDelay = 0.1 }: { children: React.ReactNode; className?: string; staggerDelay?: number }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.15 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: staggerDelay } } }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className = "", y = 30 }: { children: React.ReactNode; className?: string; y?: number }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y, scale: 0.96 },
        show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * ParallaxLayer — shifts its content vertically at a fraction of scroll speed,
 * creating depth on dark section backgrounds. `speed` of 0.3 means the layer moves
 * at 30% of normal scroll speed (feels like it's "behind" the page).
 */
export function ParallaxLayer({ children, speed = 0.3, className = "" }: { children: React.ReactNode; speed?: number; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [`${-speed * 100}px`, `${speed * 100}px`]);
  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      <motion.div style={{ y }} className="absolute inset-0">
        {children}
      </motion.div>
    </div>
  );
}

/**
 * HeroSlideshow — auto-rotating, crossfading background slideshow with a slow
 * Ken Burns zoom on the active slide. Pass at least one image; falls back gracefully.
 */
export function HeroSlideshow({ images, intervalMs = 6000 }: { images: string[]; intervalMs?: number }) {
  const validImages = images.filter(Boolean);
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (validImages.length <= 1) return;
    const timer = setInterval(() => setIndex(i => (i + 1) % validImages.length), intervalMs);
    return () => clearInterval(timer);
  }, [validImages.length, intervalMs]);

  if (validImages.length === 0) return null;

  return (
    <div className="absolute inset-0">
      <AnimatePresence mode="sync">
        <motion.div
          key={index}
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('${validImages[index]}')` }}
          initial={{ opacity: 0, scale: 1.0 }}
          animate={{ opacity: 0.8, scale: 1.12 }}
          exit={{ opacity: 0 }}
          transition={{
            opacity: { duration: 1.4, ease: "easeInOut" },
            scale: { duration: intervalMs / 1000 + 1.4, ease: "linear" }
          }}
        />
      </AnimatePresence>
      {validImages.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex gap-2">
          {validImages.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Slide ${i + 1}`}
              className={`h-1.5 rounded-full transition-all duration-500 cursor-pointer ${i === index ? "w-8 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** AnimatedCounter — counts up from 0 to `value` once it scrolls into view. */
export function AnimatedCounter({ value, duration = 1.6, suffix = "", prefix = "" }: { value: number; duration?: number; suffix?: string; prefix?: string }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    if (!inView) return;
    let start: number | null = null;
    let raf: number;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplay(Math.round(eased * value));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);

  return <span ref={ref}>{prefix}{display.toLocaleString()}{suffix}</span>;
}

/** TiltCard — subtle hover lift + scale for cards in a grid (programs, team, partners). */
export function TiltCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      whileHover={{ y: -8, scale: 1.02 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** StaggerText — splits a headline into words and cascades them in, for a
 *  cinematic hero title entrance. */
export function StaggerText({ text, className = "" }: { text: string; className?: string }) {
  const words = text.split(" ");
  return (
    <motion.span
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } } }}
    >
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="inline-block mr-[0.25em]"
          variants={{
            hidden: { opacity: 0, y: 24, rotateX: -40 },
            show: { opacity: 1, y: 0, rotateX: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } }
          }}
        >
          {word}
        </motion.span>
      ))}
    </motion.span>
  );
}
