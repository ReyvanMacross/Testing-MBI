"use client";

import type {
  ManagedUser,
  OpdOption,
  WilayahOption,
} from "@/lib/diskominfo/users";

import { UserForm } from "./user-form";

type EditUserDialogProps = {
  user: ManagedUser | null;
  opdOptions: OpdOption[];
  wilayahOptions: WilayahOption[];
  onClose: () => void;
  onSuccess: () => void;
};

export function EditUserDialog({
  user,
  opdOptions,
  wilayahOptions,
  onClose,
  onSuccess,
}: EditUserDialogProps) {
  if (!user) {
    return null;
  }

  return (
    <UserForm
      key={user.id}
      mode="edit"
      user={user}
      opdOptions={opdOptions}
      wilayahOptions={wilayahOptions}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}
