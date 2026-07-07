"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DialRoot, useDialKitController } from "dialkit";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  generateTextTargets,
  generateWreathTargets,
  mulberry32,
  type Target,
  type TextTargetOptions,
  type WreathTargetOptions,
} from "./target";
import "dialkit/styles.css";

const DEFAULT_WORDS = ["Changing", "the script", "for life"];
const FONT_FAMILY =
  '"SF Pro Rounded", ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif';
const TIMELINE_SECONDS = 6.5;

const BACKGROUND_STYLE =
  "radial-gradient(ellipse farthest-corner at center, #F6FF01 0%, #F6FF01 24%, #EFF975 55%, #D4D68A 100%)";
const MOVE_EASE = [0.22, 0.291, 0.355, 1] as const;

type ParticleTextProps = {
  words?: string[];
  className?: string;
  loop?: boolean;
  controls?: boolean;
};

type Size = {
  width: number;
  height: number;
};

/**
 * A particle owns one text target for exactly one word. The ring is the union
 * of every word's particles, so during a word's text phase only that word's
 * subset travels to the center; the rest hold the ring.
 */
type Particle = {
  id: string;
  wordIndex: number;
  home: Target;
  softHome: Target;
  textTarget: Target;
  delayIn: number;
  delayOut: number;
};

type Layout = {
  particles: Particle[];
};

type ParticleTargetOptions = {
  text: TextTargetOptions;
  ring: WreathTargetOptions & {
    seed: number;
  };
  motion: {
    staggerIn: number;
    staggerOut: number;
  };
};

type ParticleStyleOptions = {
  idleOpacity: number;
  textOpacity: number;
};

type ParticleKeyframes = {
  times: number[];
  x: number[];
  y: number[];
  width: number[];
  height: number[];
  opacity: number[];
};

type Schedule = {
  idleEnd: number;
  textIn: number;
  textOut: number;
  homeBack: number;
};

const SCHEDULES: Schedule[] = [
  { idleEnd: 0.8, textIn: 1.45, textOut: 2.25, homeBack: 3.08 },
  { idleEnd: 2.32, textIn: 3.12, textOut: 3.52, homeBack: 4.28 },
  { idleEnd: 3.55, textIn: 4.25, textOut: 4.95, homeBack: 6.02 },
];
// const SCHEDULES: Schedule[] = [
//   { idleEnd: 0.8, textIn: 1.45, textOut: 2.35, homeBack: 3.08 },
//   { idleEnd: 2.32, textIn: 3.12, textOut: 3.58, homeBack: 4.28 },
//   { idleEnd: 3.55, textIn: 4.35, textOut: 5.25, homeBack: 6.12 },
// ];

const getCenteredLeft = (target: Target) => target.x - target.w / 2;
const getCenteredTop = (target: Target) => target.y - target.s / 2;
const normalizeTime = (seconds: number) => seconds / TIMELINE_SECONDS;
const clampSecond = (seconds: number) =>
  Math.max(0, Math.min(TIMELINE_SECONDS, seconds));

const createParticles = (
  words: string[],
  width: number,
  height: number,
  options: ParticleTargetOptions,
): Layout => {
  const particleRng = mulberry32(911);
  const wordTargets = words.map((word) =>
    generateTextTargets(word, width, height, FONT_FAMILY, options.text),
  );
  const total = wordTargets.reduce((sum, targets) => sum + targets.length, 0);
  const homes = generateWreathTargets(
    Math.max(total, 1),
    width,
    height,
    mulberry32(Math.round(options.ring.seed)),
    options.ring,
  );

  const particles: Particle[] = [];
  let homeIndex = 0;

  for (let wordIndex = 0; wordIndex < words.length; wordIndex++) {
    const targets = wordTargets[wordIndex];

    for (
      let particleIndex = 0;
      particleIndex < targets.length;
      particleIndex++
    ) {
      const home = homes[homeIndex % homes.length];
      homeIndex += 1;
      const softHome = {
        ...home,
        x: home.x + (particleRng() * 2 - 1) * width * 0.006,
        y: home.y + (particleRng() * 2 - 1) * height * 0.005,
      };

      particles.push({
        id: `${wordIndex}-${particleIndex}`,
        wordIndex,
        home,
        softHome,
        textTarget: targets[particleIndex],
        delayIn: particleRng() * options.motion.staggerIn,
        delayOut: particleRng() * options.motion.staggerOut,
      });
    }
  }

  return { particles };
};

const addKeyframe = (
  keyframes: ParticleKeyframes,
  seconds: number,
  target: Target,
  opacity: number,
) => {
  const safeSeconds = clampSecond(seconds);
  const normalized = normalizeTime(safeSeconds);
  const previousTime = keyframes.times.at(-1);

  if (previousTime !== undefined && normalized <= previousTime) return;

  keyframes.times.push(normalized);
  keyframes.x.push(getCenteredLeft(target));
  keyframes.y.push(getCenteredTop(target));
  keyframes.width.push(target.w);
  keyframes.height.push(target.s);
  keyframes.opacity.push(opacity);
};

const createParticleKeyframes = (
  particle: Particle,
  options: ParticleStyleOptions,
): ParticleKeyframes => {
  const schedule = SCHEDULES[particle.wordIndex] ?? SCHEDULES[0];
  const keyframes: ParticleKeyframes = {
    times: [],
    x: [],
    y: [],
    width: [],
    height: [],
    opacity: [],
  };

  addKeyframe(keyframes, 0, particle.home, options.idleOpacity);
  addKeyframe(
    keyframes,
    schedule.idleEnd,
    particle.softHome,
    options.idleOpacity,
  );
  addKeyframe(
    keyframes,
    schedule.textIn + particle.delayIn * 0.35,
    particle.textTarget,
    options.textOpacity,
  );
  addKeyframe(
    keyframes,
    schedule.textOut,
    particle.textTarget,
    options.textOpacity,
  );
  addKeyframe(
    keyframes,
    schedule.homeBack + particle.delayOut,
    particle.home,
    options.idleOpacity,
  );
  addKeyframe(keyframes, TIMELINE_SECONDS, particle.home, options.idleOpacity);

  return keyframes;
};

export const ParticleText = ({
  words = DEFAULT_WORDS,
  className,
  loop = true,
  controls = true,
}: ParticleTextProps) => {
  const dialControllerRef = useRef<{ resetValues: () => void } | null>(null);
  const dialController = useDialKitController(
    "Particle Text",
    {
      content: {
        line1: { type: "text", default: words[0] ?? DEFAULT_WORDS[0] },
        line2: { type: "text", default: words[1] ?? DEFAULT_WORDS[1] },
        line3: { type: "text", default: words[2] ?? DEFAULT_WORDS[2] },
      },
      text: {
        letterGap: [0.9, 0.6, 2.5, 0.1] as [number, number, number, number],
        maxWidth: [0.5, 0.5, 0.9, 0.01] as [number, number, number, number],
        verticalDetail: false,
      },
      ring: {
        width: [0.85, 0.65, 0.98, 0.01] as [number, number, number, number],
        height: [0.5, 0.42, 0.78, 0.01] as [number, number, number, number],
        yOffset: [-8, -80, 80, 1] as [number, number, number, number],
        bandSpread: [0.031, 0, 0.06, 0.001] as [number, number, number, number],
        sideScatter: [0.033, 0, 0.18, 0.001] as [
          number,
          number,
          number,
          number,
        ],
      },
      particles: {
        color: { type: "color", default: "#000000" },
      },
      motion: {
        loop: true,
        duration: [8.5, 3, 12, 0.1] as [number, number, number, number],
        staggerIn: [0.4, 0, 0.5, 0.01] as [number, number, number, number],
        staggerOut: [0.35, 0, 0.6, 0.01] as [number, number, number, number],
      },
      reset: { type: "action", label: "Reset to Defaults" },
    },
    {
      id: "particle-text-v4",
      persist: true,
      onAction: (path) => {
        if (path !== "reset") return;
        dialControllerRef.current?.resetValues();
      },
    },
  );
  const dial = dialController.values;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const [size, setSize] = useState<Size | null>(null);
  const dialWords = useMemo(
    () => [dial.content.line1, dial.content.line2, dial.content.line3],
    [dial.content.line1, dial.content.line2, dial.content.line3],
  );
  const ariaLabel = useMemo(() => dialWords.join(" "), [dialWords]);
  const targetOptions = useMemo<ParticleTargetOptions>(
    () => ({
      text: {
        dotSize: 8.6,
        cellScale: 1.22,
        letterGap: dial.text.letterGap,
        maxWidth: dial.text.maxWidth,
        verticalDetail: dial.text.verticalDetail,
      },
      ring: {
        dotSize: 6.1,
        minDash: 13,
        maxDash: 39,
        widthRatio: dial.ring.width,
        heightRatio: dial.ring.height,
        yOffset: dial.ring.yOffset,
        bandSpread: dial.ring.bandSpread,
        sideScatter: dial.ring.sideScatter,
        topDensity: 0.36,
        bottomDensity: 0.32,
        sideDensity: 0.16,
        dashFrequency: 6,
        seed: 42,
      },
      motion: {
        staggerIn: dial.motion.staggerIn,
        staggerOut: dial.motion.staggerOut,
      },
    }),
    [
      dial.motion.staggerIn,
      dial.motion.staggerOut,
      dial.ring.bandSpread,
      dial.ring.height,
      dial.ring.sideScatter,
      dial.ring.width,
      dial.ring.yOffset,
      dial.text.letterGap,
      dial.text.maxWidth,
      dial.text.verticalDetail,
    ],
  );
  const particleStyle = useMemo<ParticleStyleOptions>(
    () => ({
      idleOpacity: 0.9,
      textOpacity: 1,
    }),
    [],
  );
  const layoutKey = useMemo(
    () =>
      JSON.stringify({
        words: dialWords,
        targetOptions,
      }),
    [dialWords, targetOptions],
  );
  const animationKey = useMemo(
    () =>
      JSON.stringify({
        layoutKey,
        duration: dial.motion.duration,
        loop: dial.motion.loop,
      }),
    [dial.motion.duration, dial.motion.loop, layoutKey],
  );

  useEffect(() => {
    dialControllerRef.current = dialController;
  }, [dialController]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    if (rect.width > 1 && rect.height > 1) {
      setSize({ width: rect.width, height: rect.height });
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const { width, height } = entry.contentRect;
      if (width < 1 || height < 1) return;

      setSize({ width, height });
    });

    resizeObserver.observe(wrapper);

    return () => resizeObserver.disconnect();
  }, []);

  const layout = useMemo(() => {
    if (!size) return null;
    return createParticles(dialWords, size.width, size.height, targetOptions);
  }, [dialWords, size, targetOptions]);

  return (
    <>
      <div
        ref={wrapperRef}
        className={cn("relative h-full w-full overflow-hidden", className)}
        style={{ background: BACKGROUND_STYLE }}
        role="img"
        aria-label={ariaLabel}
      >
        {layout?.particles.map((particle) => {
          const keyframes = createParticleKeyframes(particle, particleStyle);

          if (shouldReduceMotion) {
            return (
              <span
                key={`${animationKey}-${particle.id}`}
                aria-hidden="true"
                className="absolute left-0 top-0 block rounded-full"
                style={{
                  backgroundColor: dial.particles.color,
                  opacity: particleStyle.idleOpacity,
                  transform: `translate3d(${getCenteredLeft(particle.home)}px, ${getCenteredTop(
                    particle.home,
                  )}px, 0)`,
                  width: particle.home.w,
                  height: particle.home.s,
                }}
              />
            );
          }

          return (
            <motion.span
              key={`${animationKey}-${particle.id}`}
              aria-hidden="true"
              className="absolute left-0 top-0 block rounded-full will-change-transform"
              style={{ backgroundColor: dial.particles.color }}
              initial={{
                x: keyframes.x[0],
                y: keyframes.y[0],
                width: keyframes.width[0],
                height: keyframes.height[0],
                opacity: keyframes.opacity[0],
              }}
              animate={{
                x: keyframes.x,
                y: keyframes.y,
                width: keyframes.width,
                height: keyframes.height,
                opacity: keyframes.opacity,
              }}
              transition={{
                duration: dial.motion.duration,
                times: keyframes.times,
                repeat: loop && dial.motion.loop ? Infinity : 0,
                repeatType: "loop",
                ease: MOVE_EASE,
              }}
            />
          );
        })}
      </div>

      {controls && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none fixed bottom-16 right-12 z-40 flex flex-col items-center gap-1 text-sm font-semibold leading-none text-black"
          >
            <span className="mr-10">Open for control</span>
            <svg
              className="h-20 w-24 rotate-80"
              viewBox="0 0 122 97"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M116.102 0.0996005C114.952 0.334095 112.7 1.53002 111.433 2.53834C110.869 2.98388 109.368 4.15635 108.077 5.11778C103.455 8.6352 102.61 9.40903 102.187 10.4877C101.39 12.5982 102.798 14.5914 105.097 14.5914C106.13 14.5914 108.241 13.7941 109.696 12.8561C110.424 12.3871 111.01 12.0823 111.01 12.1526C111.01 12.692 107.796 17.8274 106.2 19.8206C102.023 25.0733 95.6642 29.6928 86.2548 34.2889C81.0926 36.8214 77.4555 38.2753 73.9123 39.2367C71.7066 39.823 70.6507 39.9871 67.9053 40.0809C66.0516 40.1513 64.5499 40.1747 64.5499 40.1278C64.5499 40.0809 64.808 38.9788 65.1365 37.6891C65.465 36.3993 65.8404 34.1716 66.0047 32.7647C66.4505 28.3796 65.4884 24.2994 63.4704 22.2359C62.1564 20.8758 60.9363 20.3599 59.0121 20.3599C57.6043 20.3599 57.1115 20.4537 55.7975 21.1103C52.8878 22.5407 50.5648 25.9878 49.5089 30.4197C48.453 34.922 49.2742 38.0877 52.3481 41.1127C53.4744 42.2148 54.46 42.9183 55.9852 43.6921C57.1584 44.2549 58.1439 44.7473 58.1909 44.7708C58.5898 45.0053 54.5304 53.4705 52.0666 57.6211C47.4674 65.3125 39.3486 74.575 30.5728 82.0789C22.2427 89.2309 16.7285 92.4435 9.87677 94.1553C8.28116 94.554 7.13138 94.6478 4.2452 94.6478C1.17131 94.6712 0.608154 94.7181 0.608154 95.023C0.608154 95.234 1.19478 95.5857 2.13337 95.9609C3.54126 96.4768 3.96363 96.5472 7.41296 96.5237C10.5572 96.5237 11.4724 96.4299 13.1149 96.0078C21.7265 93.6863 31.1594 87.1908 42.6102 75.7006C49.2977 69.0175 52.5828 64.9373 56.1494 58.9343C58.0501 55.7217 60.6312 50.6801 61.7575 47.9365L62.5553 45.9902L64.0806 46.1543C71.3547 46.9047 77.7136 45.3101 88.3667 40.034C96.2274 36.1414 101.976 32.3426 106.505 28.0748C108.617 26.0816 111.855 22.2828 112.794 20.7117C113.028 20.313 113.286 19.9847 113.357 19.9847C113.427 19.9847 113.662 20.782 113.873 21.72C114.084 22.6814 114.647 24.276 115.093 25.2609C115.82 26.8085 116.008 27.043 116.454 26.9727C116.876 26.9258 117.228 26.4333 117.956 24.9795C119.317 22.2828 119.833 20.2661 120.772 13.8879C121.757 7.25168 121.781 4.4143 120.889 2.56179C119.95 0.615488 118.12 -0.322489 116.102 0.0996005ZM60.7016 25.7767C61.4525 26.9023 61.8279 29.2942 61.6637 31.9205C61.4759 34.7813 60.5139 38.9788 60.0681 38.9788C59.5284 38.9788 57.1584 37.6422 56.2198 36.8214C54.8354 35.6021 54.3426 34.2889 54.5538 32.2957C54.8589 29.2473 56.1964 26.2223 57.5808 25.3547C58.7306 24.6512 60.0681 24.8388 60.7016 25.7767Z"
                fill="currentColor"
              />
            </svg>
          </span>
          <DialRoot position="bottom-right" theme="dark" defaultOpen={false} />
        </>
      )}
    </>
  );
};
