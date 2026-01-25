"use client";

import { LoadScript } from "@react-google-maps/api";
import { ReactNode } from "react";

const libraries: ("places" | "drawing" | "geometry" | "visualization")[] = ["places"];

export default function GoogleMapsLoader({ children }: { children: ReactNode }) {
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!googleMapsApiKey) {
    return <>{children}</>;
  }

  return (
    <LoadScript googleMapsApiKey={googleMapsApiKey} libraries={libraries}>
      {children}
    </LoadScript>
  );
}
