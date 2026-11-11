const raw = await fetch('https://www.coolbox.pe/api/catalog_system/pub/category/tree/1').then((res) => res.json());

const categories = raw.map((category) => ({
  id: category.id,
  name: category.name
}));

console.log(categories);