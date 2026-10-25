-- Upsert the store's six localized product categories.
-- Run after creating public.categories with fresh_catalogue_schema.sql.

begin;

insert into public.categories (id, name, description)
values
  (
    'diapering-potty',
    jsonb_build_object(
      'ar', 'الحفاضات والتدريب على استخدام المرحاض',
      'en', 'Diapering & Potty',
      'fr', 'Couches et propreté',
      'es', 'Pañales y orinal'
    ),
    jsonb_build_object(
      'ar', 'حفاضات ومستلزمات تغيير الطفل والتدريب على استخدام المرحاض.',
      'en', 'Diapers, changing essentials, and potty-training supplies.',
      'fr', 'Couches, accessoires de change et articles pour l’apprentissage de la propreté.',
      'es', 'Pañales, artículos para el cambio y productos para aprender a ir al baño.'
    )
  ),
  (
    'feeding-nursing',
    jsonb_build_object(
      'ar', 'الرضاعة والتغذية',
      'en', 'Feeding & Nursing',
      'fr', 'Alimentation et allaitement',
      'es', 'Alimentación y lactancia'
    ),
    jsonb_build_object(
      'ar', 'مستلزمات الرضاعة الطبيعية والرضاعة بالزجاجة وإطعام الطفل.',
      'en', 'Breastfeeding, bottle-feeding, and baby-feeding essentials.',
      'fr', 'Essentiels pour l’allaitement, le biberon et les repas de bébé.',
      'es', 'Artículos esenciales para la lactancia, el biberón y la alimentación del bebé.'
    )
  ),
  (
    'bath-skincare-health',
    jsonb_build_object(
      'ar', 'الاستحمام والعناية بالبشرة والصحة',
      'en', 'Bath, Skincare & Health',
      'fr', 'Bain, soins de la peau et santé',
      'es', 'Baño, cuidado de la piel y salud'
    ),
    jsonb_build_object(
      'ar', 'مستلزمات استحمام الطفل والعناية ببشرته وصحته اليومية.',
      'en', 'Bath-time, skincare, and everyday health essentials for babies and children.',
      'fr', 'Essentiels pour le bain, les soins de la peau et la santé quotidienne des bébés et des enfants.',
      'es', 'Artículos esenciales para el baño, el cuidado de la piel y la salud diaria de bebés y niños.'
    )
  ),
  (
    'clothing-footwear',
    jsonb_build_object(
      'ar', 'الملابس والأحذية',
      'en', 'Clothing & Footwear',
      'fr', 'Vêtements et chaussures',
      'es', 'Ropa y calzado'
    ),
    jsonb_build_object(
      'ar', 'ملابس وأحذية مريحة للأطفال والرضع.',
      'en', 'Comfortable clothing and footwear for babies and children.',
      'fr', 'Vêtements et chaussures confortables pour les bébés et les enfants.',
      'es', 'Ropa y calzado cómodos para bebés y niños.'
    )
  ),
  (
    'nursery-sleep',
    jsonb_build_object(
      'ar', 'غرفة الطفل والنوم',
      'en', 'Nursery & Sleep',
      'fr', 'Chambre de bébé et sommeil',
      'es', 'Habitación infantil y sueño'
    ),
    jsonb_build_object(
      'ar', 'أسرّة الأطفال ومستلزمات الفراش ومراقبة الطفل ومنتجات النوم.',
      'en', 'Cribs, bedding, baby monitors, and sleep essentials.',
      'fr', 'Lits bébé, literie, babyphones et essentiels pour le sommeil.',
      'es', 'Cunas, ropa de cama, vigilabebés y artículos para dormir.'
    )
  ),
  (
    'gear-safety-toys',
    jsonb_build_object(
      'ar', 'معدات التنقل والسلامة والألعاب',
      'en', 'Gear, Safety & Toys',
      'fr', 'Équipement, sécurité et jouets',
      'es', 'Equipamiento, seguridad y juguetes'
    ),
    jsonb_build_object(
      'ar', 'عربات الأطفال ومقاعد السيارة ومستلزمات السلامة والألعاب.',
      'en', 'Strollers, car seats, safety essentials, and toys.',
      'fr', 'Poussettes, sièges auto, articles de sécurité et jouets.',
      'es', 'Cochecitos, sillas de coche, artículos de seguridad y juguetes.'
    )
  )
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description;

commit;
