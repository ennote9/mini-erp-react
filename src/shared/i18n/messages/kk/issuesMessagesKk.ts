import type { MessageTree } from "../../resolve";

export const kkIssuesMessages: MessageTree = {
  planning: {
    dateRequired: "Күнді көрсетіңіз.",
    dateFormat: "Күн ЖЖЖЖ-АА-КК форматында болуы керек (мыс. 2025-03-15).",
    dateYearRange: "Күннің жылы {{min}} мен {{max}} арасында болуы керек.",
    supplierInactive: "Таңдалған жеткізуші белсенді емес.",
    customerInactive: "Таңдалған клиент белсенді емес.",
    warehouseInactive: "Таңдалған қойма белсенді емес.",
    zeroPriceReasonRequired:
      "Нөлдік баға бар әр жол үшін нөлдік баға себебін көрсетіңіз.",
  },
  master: {
    codeRequired: "Код міндетті.",
    nameRequired: "Атауы міндетті.",
    nameMinLength: "Атауы кемінде {{min}} таңба болуы керек.",
    itemCodePattern:
      "Кодта тек әріптер, сандар, сызықша және астын сызу болады.",
    uomRequired: "Өлш. б. міндетті.",
    uomMaxLength: "Өлш. б. {{max}} таңбадан аспауы керек.",
    purchasePriceInvalid: "Сатып алу бағасы сан болуы керек.",
    purchasePriceNegative: "Сатып алу бағасы теріс болмауы керек.",
    salePriceInvalid: "Сату бағасы сан болуы керек.",
    salePriceNegative: "Сату бағасы теріс болмауы керек.",
    phoneFormat:
      "Телефон форматы дұрыс емес. Тек сандар, бос орын, +, - және жақшалар.",
    phoneDigit: "Телефонда кемінде бір сан болуы керек.",
    emailInvalid: "Email форматы дұрыс емес.",
    paymentTermsInvalid: "Төлем мерзімі сан болуы керек.",
    paymentTermsNegative: "Төлем мерзімі теріс болмауы керек.",
    paymentTermsDaysForm:
      "Төлем мерзімі — күн саны бүтін сан ≥ 0 немесе бос қалдырыңыз.",
    carrierTypeRequired: "Тасымалдаушы түрі міндетті.",
    carrierTypeInvalid: "Жарамды тасымалдаушы түрін таңдаңыз.",
  },
  document: {
    supplierRequired: "Жеткізуші міндетті.",
    customerRequired: "Клиент міндетті.",
    warehouseRequired: "Қойма міндетті.",
    linesRequired: "Кемінде бір жол қажет.",
    linesValidRequired:
      "Кемінде бір дұрыс жол қажет (тауар және саны).",
    inactiveItems: "Құжатта белсенді емес тауарларды қолдануға болмайды.",
    linesNoItem: "Бір немесе бірнеше жолда тауар таңдалмаған.",
    linesInvalidQty: "Бір немесе бірнеше жолда саны дұрыс емес немесе нөл.",
    linesInvalidUnitPrice:
      "Бір немесе бірнеше жолда баға дұрыс емес (сан ≥ 0).",
    zeroPriceMissingReasonOne:
      "Бір жолда нөлдік баға себебі жоқ. Себепті көрсетіңіз.",
    zeroPriceMissingReasonMany:
      "{{count}} жолда нөлдік баға себебі жоқ.",
    zeroPriceRecordedOne: "1 жол нөлдік бағамен (себеп жазылған).",
    zeroPriceRecordedMany:
      "{{count}} жол нөлдік бағамен (себептер жазылған).",
    zeroLineAmountOne: "1 жолдың сомасы нөл.",
    zeroLineAmountMany: "{{count}} жолдың сомасы нөл.",
  },
  receipt: {
    notFound: "Түсім табылмады.",
    onlyDraftPost: "Тек жоба түсімдерін жүргізуге болады.",
    poRequired: "Байланысты сатып алу тапсырысы қажет.",
    poMustBeConfirmed:
      "Жүргізу үшін байланысты сатып алу тапсырысы расталған болуы керек.",
    warehouseRequired: "Қойма міндетті.",
    warehouseInactive: "Таңдалған қойма белсенді емес.",
    linesRequired: "Кемінде бір жол қажет.",
    lineNeedsItem: "Әр жолда тауар болуы керек.",
    qtyPositive: "Саны нөлден үлкен болуы керек.",
    itemInactive: "Таңдалған тауар белсенді емес.",
    duplicateItems: "Бір құжатта тауардың көшірмелері рұқсат етілмейді.",
    itemNotOnPo: "{{code}} тауары байланысты сатып алу тапсырысында жоқ.",
    qtyExceedsRemaining:
      "{{code}}: түсім саны қалғанға артық (тапсырыс {{ordered}}, алынған {{already}}, осы түсімде {{qty}}).",
    onlyDraftCancel: "Тек жоба түсімдерін болдырмауға болады.",
    alreadyReversed: "Бұл түсім қазірдің өзінде кері қайтарылған.",
    onlyPostedReverse: "Тек жүргізілген түсімдерді кері қайтаруға болады.",
    noLinesReverse: "Жолдар жоқ; кері қайтару мүмкін емес.",
    invalidQtyReverse:
      "Бір немесе бірнеше жолда кері қайтару үшін саны дұрыс емес.",
    insufficientStockReverse:
      "{{code}}: түсімді кері қайтаруға қор жеткіліксіз (қолжетімді {{available}}, қажет {{required}}).",
  },
  shipment: {
    notFound: "Жөнелту табылмады.",
    onlyDraftPost: "Тек жоба жөнелтулерін жүргізуге болады.",
    soRequired: "Байланысты сату тапсырысы қажет.",
    soMustBeConfirmed:
      "Жүргізу үшін байланысты сату тапсырысы расталған болуы керек.",
    warehouseMismatchSo:
      "Жөнелту қоймасы сату тапсырысының қоймасымен сәйкес келуі керек.",
    warehouseRequired: "Қойма міндетті.",
    warehouseInactive: "Таңдалған қойма белсенді емес.",
    linesRequired: "Кемінде бір жол қажет.",
    lineNeedsItem: "Әр жолда тауар болуы керек.",
    qtyPositive: "Саны нөлден үлкен болуы керек.",
    itemInactive: "Таңдалған тауар белсенді емес.",
    duplicateItems: "Бір құжатта тауардың көшірмелері рұқсат етілмейді.",
    itemNotOnSo: "{{code}} тауары байланысты сату тапсырысында жоқ.",
    qtyExceedsRemaining:
      "{{code}}: жөнелту саны қалғанға артық (тапсырыс {{ordered}}, жөнелтілген {{already}}, осы жөнелтуде {{qty}}).",
    insufficientReserved:
      "{{code}}: жүргізуге резерв жеткіліксіз (резервте {{reserved}}, қажет {{required}}). Сату тапсырысында резервтеу қолданыңыз.",
    insufficientStockPost:
      "{{code}}: жүргізуге қор жеткіліксіз (қолжетімді {{available}}, қажет {{required}}).",
    noBufferWarning:
      "{{code}}: буфер жоқ (жөнелтілгені қолжетімді қорға тең).",
    reservationConsumeFailed:
      "Резервтерді жою мүмкін болмады. Жаңартыңыз немесе сату тапсырысында қайта резервтеңіз.",
    onlyDraftCancel: "Тек жоба жөнелтулерін болдырмауға болады.",
    onlyDraftEdit: "Тек жоба жөнелтулерін өңдеуге болады.",
    invalidCarrierReference: "Таңдалған тасымалдаушы жарамсыз.",
    alreadyReversed: "Бұл жөнелту қазірдің өзінде кері қайтарылған.",
    onlyPostedReverse: "Тек жүргізілген жөнелтулерді кері қайтаруға болады.",
    noLinesReverse: "Жолдар жоқ; кері қайтару мүмкін емес.",
    invalidQtyReverse:
      "Бір немесе бірнеше жолда кері қайтару үшін саны дұрыс емес.",
  },
  import: {
    addedSkipped: "Қосылды: {{added}} тауар. Өткізілді: {{skipped}} жол.",
  },
  reason: {
    cancelRequired: "Болдырмау себебін көрсетіңіз.",
    cancelInvalid: "Жарамды болдырмау себебін таңдаңыз.",
    reversalRequired: "Кері қайтару себебін көрсетіңіз.",
    reversalInvalid: "Жарамды кері қайтару себебін таңдаңыз.",
  },
  save: {
    brandDuplicate: "Мұндай кодты бренд бар.",
    categoryDuplicate: "Мұндай кодты санат бар.",
    supplierDuplicate: "Мұндай кодты жеткізуші бар.",
    customerDuplicate: "Мұндай кодты клиент бар.",
    warehouseDuplicate: "Мұндай кодты қойма бар.",
    carrierDuplicate: "Мұндай кодты тасымалдаушы бар.",
    carrierNotFound: "Тасымалдаушы табылмады.",
    itemDuplicate: "Мұндай кодты тауар бар.",
    brandNotFound: "Бренд табылмады.",
    categoryNotFound: "Санат табылмады.",
    supplierNotFound: "Жеткізуші табылмады.",
    customerNotFound: "Клиент табылмады.",
    warehouseNotFound: "Қойма табылмады.",
    itemNotFound: "Тауар табылмады.",
    brandInactive: "Таңдалған бренд белсенді емес.",
    categoryInactive: "Таңдалған санат белсенді емес.",
    purchasePriceValid: "Сатып алу бағасы сан болуы керек.",
    purchasePriceNegative: "Сатып алу бағасы теріс болмауы керек.",
    salePriceValid: "Сату бағасы сан болуы керек.",
    salePriceNegative: "Сату бағасы теріс болмауы керек.",
    brandSelectNotFound: "Таңдалған бренд табылмады.",
    categorySelectNotFound: "Таңдалған санат табылмады.",
    paymentTermsValid: "Төлем мерзімі сан болуы керек.",
    paymentTermsNegative: "Төлем мерзімі теріс болмауы керек.",
    poUnitPriceInvalid: "Әр жолда жарамды баға болуы керек (сан ≥ 0).",
    poNotFound: "Сатып алу тапсырысы табылмады.",
    poOnlyDraftSave: "Тек жоба сатып алу тапсырыстарын сақтауға болады.",
    poOnlyDraftConfirm: "Тек жоба сатып алу тапсырыстарын растауға болады.",
    poCancelStates:
      "Тек жоба немесе расталған сатып алу тапсырыстарын болдырмауға болады.",
    poReceiptConfirmedOnly:
      "Түсімді тек расталған сатып алу тапсырысынан жасауға болады.",
    poFullyReceived: "Сатып алу тапсырысы толық түсірілген (жүргізілген түсімдер).",
    poDraftReceiptExists: "Осы тапсырыс үшін түсім жобасы бар.",
    poNothingToReceive: "Осы тапсырыс бойынша түсіретін ештеңе жоқ.",
    soUnitPriceInvalid: "Әр жолда жарамды баға болуы керек (сан ≥ 0).",
    soNotFound: "Сату тапсырысы табылмады.",
    soOnlyDraftSave: "Тек жоба сату тапсырыстарын сақтауға болады.",
    soOnlyDraftConfirm: "Тек жоба сату тапсырыстарын растауға болады.",
    soAllocateConfirmedOnly: "Тек расталған сату тапсырыстарын резервтеуге болады.",
    soCancelStates:
      "Тек жоба немесе расталған сату тапсырыстарын болдырмауға болады.",
    soShipmentConfirmedOnly:
      "Жөнелтуді тек расталған сату тапсырысынан жасауға болады.",
    soFullyShipped: "Сату тапсырысы толық жөнелтілген (жүргізілген жөнелтулер).",
    soDraftShipmentExists: "Осы тапсырыс үшін жөнелту жобасы бар.",
    soNothingToShip: "Осы тапсырыс бойынша жөнелтетін ештеңе жоқ.",
    itemsPersistFailed: "Тауарларды дискіге сақтау мүмкін болмады.",
  },
};
