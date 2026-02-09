import React from "react";

export default function UserMeta({ user }: any) {
  if (!user) return null;
  return (
    <>
      {user.meta?.street && <>{user.meta?.street},</>} {user.meta?.postal}{" "}
      {user.meta?.city}
    </>
  );
}
