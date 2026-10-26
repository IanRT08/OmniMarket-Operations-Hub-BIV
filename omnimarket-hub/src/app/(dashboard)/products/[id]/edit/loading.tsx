import { FormSkeleton } from "@/components/form-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditProductLoading() {
  return (
    <>
      <div className="mb-5 flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <FormSkeleton sections={[2, 3]} />
    </>
  );
}
