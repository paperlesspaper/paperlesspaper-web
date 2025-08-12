import React from "react";

export default function Icon({ addIcon, className, icon, raw }: any) {
  const LazyIconLoad = icon;

  const handleClick = async () => {
    try {
      addIcon(raw);
    } catch (error) {
      console.error("Error loading icon:", error);
    }
  };

  return (
    <React.Suspense fallback={<div>Loading icon...</div>}>
      <div onClick={handleClick} className={className}>
        <LazyIconLoad />
      </div>
    </React.Suspense>
  );
}
