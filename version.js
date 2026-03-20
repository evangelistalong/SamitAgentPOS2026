// =============================================================
// SAMIT AGENT POS — Version & Category Map
// Update APP_VERSION every deploy (YYYY.MMDD.BUILD)
// =============================================================

const APP_VERSION  = '2026.0321.2';
const APP_BUILT_BY = 'Paul Evangelista';

// SKU → Category mapping from Pbest ItemMapping
// Any SKU not listed falls back to 'Others'
const SKU_CATEGORY_MAP = {
    "1003":"Tocino","1005":"Tapa","1006":"Corned Beef","1007":"Tocino",
    "1008":"Bacon","1009":"Tapa","1010":"Ham","1013":"Hotdog",
    "1014":"Hotdog","1015":"Hotdog","1017":"Longaniza","1018":"Hotdog",
    "1019":"BBQ","1023":"Hotdog","1026":"Hotdog","1027":"Hotdog",
    "1028":"Longaniza","1029":"Longaniza","1030":"Longaniza","1031":"Longaniza",
    "1032":"Longaniza","1033":"Longaniza","1035":"Longaniza","1036":"Longaniza",
    "1037":"Longaniza","1038":"Embotido","1039":"Tocino","1040":"Hotdog",
    "1043":"Patties","1044":"Hotdog","1047":"Patties","1050":"Sisig",
    "1052":"Patties","1053":"Hotdog","1058":"Tocino","1059":"Tocino",
    "1060":"Tenderlicious","1061":"Hotdog","1063":"BBQ","1064":"Hotdog",
    "1066":"Longaniza","1067":"Hotdog","1069":"BBQ","1070":"Hotdog",
    "1077":"Ham","1080":"Tocino","1085":"Tenderlicious","1087":"Sausage",
    "1091":"Sausage","1092":"Sausage","1096":"Tapa","1097":"Tapa",
    "1123":"Hotdog","1126":"Hotdog","1129":"Chicken Pops","1130":"Others",
    "1131":"BBQ","1132":"Others","1133":"Others","1134":"Others",
    "1143":"Sausage","1159":"Sausage","1162":"Longaniza","1237":"Hotdog",
    "2130":"Others",
};

function getItemCategory(sku) {
    return SKU_CATEGORY_MAP[String(sku)] || 'Others';
}
