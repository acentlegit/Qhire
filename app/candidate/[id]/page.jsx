import Profile from '../../../components/candidate/Profile'

export default function Page({ params }) {
  return <Profile candidateId={params.id} />
}