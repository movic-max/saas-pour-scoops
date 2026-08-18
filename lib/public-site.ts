export type PublicSiteActivity = { id: string; number: string; title: string; text: string; image: string; iconKey: string; tone: string };
export type PublicSiteCommitment = { id: string; title: string; text: string; iconKey: string };
export type PublicSiteContent = { heroImage: string; logo: string; heroEyebrow: string; heroTitle: string; heroSubtitle: string; heroIntro: string; city: string; activities: PublicSiteActivity[]; commitments: PublicSiteCommitment[]; footer: { email: string; phone: string; address: string; facebook: string; whatsapp: string } };

export const DEFAULT_PUBLIC_SITE_CONTENT: PublicSiteContent = {
  heroImage: '/hero-agro.jpg',
  logo: '/scoops-le-reveil-logo.jpg',
  heroEyebrow: 'SCOOPS LE REVEIL · Obala, Cameroun',
  heroTitle: 'Produire localement.',
  heroSubtitle: 'Transformer avec exigence.',
  heroIntro: 'SCOOPS LE REVEIL développe une agriculture intégrée, fondée sur l’élevage de poulets bio, la chèvrerie, la transformation, la valorisation des produits locaux et le travail collectif.',
  city: 'Obala, Cameroun',
  activities: [
    { id: 'poulets', number: '01', title: 'Élevage de poulets bio', text: 'Une conduite attentive des bandes, de l’alimentation, de la santé et de la commercialisation en filière bio.', image: '/unit-poulets-bio.jpg', iconKey: 'PawPrint', tone: 'green' },
    { id: 'chevrerie', number: '02', title: 'Chèvrerie', text: 'Un cheptel caprin suivi avec soin : animaux, reproduction, santé, alimentation et productions.', image: '/unit-chevrerie.jpg', iconKey: 'Sprout', tone: 'blue' },
    { id: 'provenderie', number: '03', title: 'Provenderie', text: 'La fabrication d’aliments adaptés aux élevages, à partir de matières premières suivies.', image: '/unit-provenderie.jpg', iconKey: 'Wheat', tone: 'orange' },
    { id: 'bio', number: '04', title: 'Produits bio', text: 'La transformation de matières naturelles en préparations utiles aux élevages et à l’agriculture.', image: '/unit-produits-bio.jpg', iconKey: 'FlaskConical', tone: 'purple' },
    { id: 'pressoir', number: '05', title: 'Pressoir à huile', text: 'La valorisation des graines locales en huiles et tourteaux, avec une attention portée aux rendements.', image: '/unit-pressoir.jpg', iconKey: 'Droplets', tone: 'yellow' },
    { id: 'stocks', number: '06', title: 'Magasin central', text: 'Un espace principalement consacré aux produits et machines agricoles, avec une gestion rigoureuse des stocks.', image: '/unit-magasin-central.jpg', iconKey: 'Package', tone: 'blue' },
  ],
  commitments: [
    { id: 'quality', title: 'Qualité et traçabilité', text: 'Chaque activité est suivie avec méthode, de l’approvisionnement jusqu’au produit ou service livré.', iconKey: 'ShieldCheck' },
    { id: 'cooperation', title: 'Des activités qui se complètent', text: 'Les unités coopèrent sans perdre leur autonomie, pour mieux valoriser les ressources de la société.', iconKey: 'ArrowLeftRight' },
    { id: 'responsibility', title: 'Une gestion responsable', text: 'Les coûts, les stocks et les résultats sont suivis pour soutenir des décisions durables.', iconKey: 'CircleDollarSign' },
  ],
  footer: { email: '', phone: '', address: 'Obala, Centre, Cameroun', facebook: '', whatsapp: '' },
};
