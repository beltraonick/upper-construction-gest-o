import { PendingScreen } from './PendingScreen'

export default function PendingPage({
  searchParams,
}: {
  searchParams: { registered?: string }
}) {
  return <PendingScreen justRegistered={searchParams.registered === '1'} />
}
