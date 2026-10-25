import "server-only";
import { NativeAuthApproval } from "../../features/native-auth/approval";

export default async function NativeAuthPage({
  searchParams,
}: {
  searchParams: Promise<{
    id?: string | string[];
    returnTo?: string | string[];
  }>;
}) {
  const { id, returnTo } = await searchParams;
  return (
    <NativeAuthApproval
      id={typeof id === "string" ? id : null}
      returnTo={returnTo === "android" ? "android" : undefined}
    />
  );
}
