-- Upsert the store's six localized product categories.
-- Also seeds the fixed, localized color registry used by product options.
-- Run after fresh_catalogue_schema.sql.

begin;

insert into public.categories (id, name, description)
values
  (
    'diapering-potty',
    jsonb_build_object(
      'ar', 'عناية الحفاض',
      'en', 'Diaper Care',
      'fr', 'Change Bébé',
      'es', 'Cuidado Pañal'
    ),
    jsonb_build_object(
      'ar', 'كل ما يلزم لتغيير نظيف ومريح.',
      'en', 'Clean, comfy diaper changes made simple.',
      'fr', 'Tout pour un change propre et confortable.',
      'es', 'Todo para cambios limpios y cómodos.'
    )
  ),
  (
    'feeding-nursing',
    jsonb_build_object(
      'ar', 'وقت الرضاعة',
      'en', 'Feeding Time',
      'fr', 'Repas Bébé',
      'es', 'Hora Comer'
    ),
    jsonb_build_object(
      'ar', 'لحظات رضاعة سعيدة للأم والطفل.',
      'en', 'Happy feeding moments for baby and mom.',
      'fr', 'Repas heureux pour bébé et maman.',
      'es', 'Alimentación feliz para bebé y mamá.'
    )
  ),
  (
    'bath-skincare-health',
    jsonb_build_object(
      'ar', 'حمام وعناية',
      'en', 'Bath & Care',
      'fr', 'Bain & Soins',
      'es', 'Baño y Cuidado'
    ),
    jsonb_build_object(
      'ar', 'عناية لطيفة للاستحمام والبشرة والصحة.',
      'en', 'Gentle care for bath, skin, health.',
      'fr', 'Soins doux pour bain, peau et santé.',
      'es', 'Cuidado suave para baño, piel y salud.'
    )
  ),
  (
    'clothing-footwear',
    jsonb_build_object(
      'ar', 'أزياء صغيرة',
      'en', 'Little Outfits',
      'fr', 'Petites Tenues',
      'es', 'Ropita Bebé'
    ),
    jsonb_build_object(
      'ar', 'ملابس ناعمة وجميلة لكل يوم.',
      'en', 'Soft, cute outfits for every day.',
      'fr', 'Tenues douces et mignonnes pour chaque jour.',
      'es', 'Ropita suave y linda para cada día.'
    )
  ),
  (
    'nursery-sleep',
    jsonb_build_object(
      'ar', 'أحلام هادئة',
      'en', 'Sweet Dreams',
      'fr', 'Doux Dodo',
      'es', 'Dulces Sueños'
    ),
    jsonb_build_object(
      'ar', 'أساسيات نوم مريحة لأحلام هادئة.',
      'en', 'Cozy sleep essentials for sweet dreams.',
      'fr', 'Essentiels cosy pour des nuits douces.',
      'es', 'Esenciales acogedores para dulces sueños.'
    )
  ),
  (
    'gear-safety-toys',
    jsonb_build_object(
      'ar', 'حركة ولعب',
      'en', 'Move & Play',
      'fr', 'Balade & Jeux',
      'es', 'Paseo y Juegos'
    ),
    jsonb_build_object(
      'ar', 'معدات آمنة وألعاب ممتعة لمغامرات سعيدة.',
      'en', 'Safe gear, fun toys, happy adventures.',
      'fr', 'Équipement sûr, jouets amusants, belles aventures.',
      'es', 'Equipamiento seguro, juguetes divertidos y aventuras.'
    )
  )
on conflict (id) do update
set
  name = excluded.name,
  description = excluded.description;

insert into public.colors (id, label, hex_color, aliases, sort_order)
values
  ('beige', '{"ar":"بيج","en":"Beige","fr":"Beige","es":"Beige"}', '#D8C3A5', array['beige'], 1),
  ('black', '{"ar":"أسود","en":"Black","fr":"Noir","es":"Negro"}', '#222222', array['black','noir','negro','اسود','أسود'], 2),
  ('blue', '{"ar":"أزرق","en":"Blue","fr":"Bleu","es":"Azul"}', '#4A78B8', array['blue','bleu','azul','ازرق','أزرق'], 3),
  ('brown', '{"ar":"بني","en":"Brown","fr":"Marron","es":"Marrón"}', '#805A3B', array['brown','marron','marrón','بني'], 4),
  ('cream', '{"ar":"كريمي","en":"Cream","fr":"Écru","es":"Crema"}', '#F3E9D2', array['cream','ecru','écru','crema','أبيض كريمي','ابيض كريمي','كريمي'], 5),
  ('gray', '{"ar":"رمادي","en":"Gray","fr":"Gris","es":"Gris"}', '#858585', array['gray','grey','gris','رمادي'], 6),
  ('green', '{"ar":"أخضر","en":"Green","fr":"Vert","es":"Verde"}', '#4D8A59', array['green','vert','verde','اخضر','أخضر'], 7),
  ('navy', '{"ar":"كحلي","en":"Navy","fr":"Bleu marine","es":"Azul marino"}', '#253858', array['navy','bleu marine','azul marino','كحلي'], 8),
  ('orange', '{"ar":"برتقالي","en":"Orange","fr":"Orange","es":"Naranja"}', '#E17A35', array['orange','naranja','برتقالي'], 9),
  ('pink', '{"ar":"وردي","en":"Pink","fr":"Rose","es":"Rosa"}', '#D97891', array['pink','rose','rosa','وردي'], 10),
  ('purple', '{"ar":"بنفسجي","en":"Purple","fr":"Violet","es":"Morado"}', '#8157A5', array['purple','violet','morado','بنفسجي'], 11),
  ('red', '{"ar":"أحمر","en":"Red","fr":"Rouge","es":"Rojo"}', '#C84444', array['red','rouge','rojo','احمر','أحمر'], 12),
  ('sage', '{"ar":"أخضر هادئ","en":"Sage","fr":"Vert sauge","es":"Verde salvia"}', '#A8B49A', array['sage','vert sauge','verde salvia','أخضر هادئ'], 13),
  ('silver', '{"ar":"فضي","en":"Silver","fr":"Argenté","es":"Plateado"}', '#B8B8B8', array['silver','argenté','argente','plateado','فضي'], 14),
  ('white', '{"ar":"أبيض","en":"White","fr":"Blanc","es":"Blanco"}', '#FFFFFF', array['white','blanc','blanco','ابيض','أبيض'], 15),
  ('yellow', '{"ar":"أصفر","en":"Yellow","fr":"Jaune","es":"Amarillo"}', '#E6C84F', array['yellow','jaune','amarillo','اصفر','أصفر'], 16)
on conflict (id) do update
set
  label = excluded.label,
  hex_color = excluded.hex_color,
  aliases = excluded.aliases,
  sort_order = excluded.sort_order,
  active = true;

commit;
