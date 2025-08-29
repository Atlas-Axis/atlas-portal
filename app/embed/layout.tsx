export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="w-full max-w-2xl rounded-2xl border bg-gray-100 p-6">{children}</div>
    </div>
  );
}
