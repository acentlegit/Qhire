import OfferBuilder from '../../../components/offer/OfferBuilder'

export default function Page({ params }) {
  return <OfferBuilder offerId={params.id} />
}