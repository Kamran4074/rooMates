"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";

// Forms that only appear inside a modal, split into their own chunks: their
// code is downloaded the first time someone opens that modal, not with every
// page (Modal renders nothing while closed). The skeleton covers the moment
// the chunk is on its way.
const loading = () => <Skeleton className="h-56 w-full rounded-2xl" />;

export const AddExpenseForm = dynamic(() => import("./rooms/AddExpenseForm").then((m) => m.AddExpenseForm), { loading });
export const CreateRoomForm = dynamic(() => import("./rooms/CreateRoomForm").then((m) => m.CreateRoomForm), { loading });
export const JoinRoomForm = dynamic(() => import("./rooms/JoinRoomForm").then((m) => m.JoinRoomForm), { loading });
export const SettlePaymentForm = dynamic(() => import("./rooms/SettlePaymentForm").then((m) => m.SettlePaymentForm), { loading });
export const CategoryForm = dynamic(() => import("./rooms/CategoryForm").then((m) => m.CategoryForm), { loading });
export const CreateFundForm = dynamic(() => import("./funds/CreateFundForm").then((m) => m.CreateFundForm), { loading });
export const RecordPaymentForm = dynamic(() => import("./funds/RecordPaymentForm").then((m) => m.RecordPaymentForm), { loading });
export const SpendFromFundForm = dynamic(() => import("./funds/SpendFromFundForm").then((m) => m.SpendFromFundForm), { loading });
export const CloseFundPreview = dynamic(() => import("./funds/CloseFundPreview").then((m) => m.CloseFundPreview), { loading });
