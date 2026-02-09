import React from "react";

const SidebarSearch = ({
  className,
  search,
}: {
  className?: string;
  search?: string;
}) => {
  return <div className={className}>{search}</div>;
};

export default SidebarSearch;
