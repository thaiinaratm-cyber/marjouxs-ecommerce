"use client";

import Link from "next/link";
import type { ComponentProps, MouseEventHandler } from "react";
import { trackEvents, type AnalyticsEventSpec } from "@/lib/analytics";

type AnalyticsLinkProps = Omit<ComponentProps<typeof Link>, "onClick"> & {
  analyticsEvents: AnalyticsEventSpec | AnalyticsEventSpec[];
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

type AnalyticsAnchorProps = ComponentProps<"a"> & {
  analyticsEvents: AnalyticsEventSpec | AnalyticsEventSpec[];
};

export function AnalyticsLink({
  analyticsEvents,
  onClick,
  ...props
}: AnalyticsLinkProps) {
  const handleClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
    trackEvents(analyticsEvents);
    onClick?.(event);
  };

  return <Link {...props} onClick={handleClick} />;
}

export function AnalyticsAnchor({
  analyticsEvents,
  onClick,
  ...props
}: AnalyticsAnchorProps) {
  const handleClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
    trackEvents(analyticsEvents);
    onClick?.(event);
  };

  return <a {...props} onClick={handleClick} />;
}