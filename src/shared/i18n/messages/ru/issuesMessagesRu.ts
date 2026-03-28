import type { MessageTree } from "../../resolve";

export const ruIssuesMessages: MessageTree = {
  planning: {
    dateRequired: "Укажите дату.",
    dateFormat: "Дата должна быть в формате ГГГГ-ММ-ДД (напр. 2025-03-15).",
    dateYearRange: "Год даты должен быть от {{min}} до {{max}}.",
    supplierInactive: "Выбранный поставщик неактивен.",
    customerInactive: "Выбранный клиент неактивен.",
    warehouseInactive: "Выбранный склад неактивен.",
    zeroPriceReasonRequired:
      "Для каждой строки с нулевой ценой укажите причину нулевой цены.",
  },
  master: {
    codeRequired: "Код обязателен.",
    nameRequired: "Наименование обязательно.",
    nameMinLength: "Наименование — не менее {{min}} символов.",
    itemCodePattern:
      "Код может содержать только буквы, цифры, дефис и подчёркивание.",
    uomRequired: "Ед. изм. обязательна.",
    uomMaxLength: "Ед. изм. — не более {{max}} символов.",
    purchasePriceInvalid: "Закупочная цена должна быть числом.",
    purchasePriceNegative: "Закупочная цена не может быть отрицательной.",
    salePriceInvalid: "Цена продажи должна быть числом.",
    salePriceNegative: "Цена продажи не может быть отрицательной.",
    phoneFormat:
      "Неверный формат телефона. Допустимы цифры, пробелы, +, - и скобки.",
    phoneDigit: "В телефоне должна быть хотя бы одна цифра.",
    emailInvalid: "Неверный формат email.",
    paymentTermsInvalid: "Срок оплаты должен быть числом.",
    paymentTermsNegative: "Срок оплаты не может быть отрицательным.",
    paymentTermsDaysForm:
      "Срок оплаты — целое число дней ≥ 0 или оставьте поле пустым.",
    carrierTypeRequired: "Тип перевозчика обязателен.",
    carrierTypeInvalid: "Выберите допустимый тип перевозчика.",
    preferredCarrierInvalid: "Предпочтительный перевозчик недействителен.",
  },
  document: {
    supplierRequired: "Поставщик обязателен.",
    customerRequired: "Клиент обязателен.",
    warehouseRequired: "Склад обязателен.",
    linesRequired: "Нужна хотя бы одна строка.",
    linesValidRequired:
      "Нужна хотя бы одна корректная строка (номенклатура и количество).",
    inactiveItems: "В документе нельзя использовать неактивные позиции.",
    linesNoItem: "В одной или нескольких строках не выбрана номенклатура.",
    linesInvalidQty: "В одной или нескольких строках неверное или нулевое количество.",
    linesInvalidUnitPrice:
      "В одной или нескольких строках неверная цена (число ≥ 0).",
    zeroPriceMissingReasonOne:
      "У одной строки нулевая цена без причины. Укажите причину нулевой цены.",
    zeroPriceMissingReasonMany:
      "У {{count}} строк нулевая цена без причины.",
    zeroPriceRecordedOne: "1 строка с нулевой ценой (причина указана).",
    zeroPriceRecordedMany:
      "{{count}} строк с нулевой ценой (причины указаны).",
    zeroLineAmountOne: "1 строка с нулевой суммой.",
    zeroLineAmountMany: "{{count}} строк с нулевой суммой.",
  },
  receipt: {
    notFound: "Поступление не найдено.",
    onlyDraftPost: "Проводить можно только черновики поступлений.",
    poRequired: "Нужен связанный заказ на покупку.",
    poMustBeConfirmed:
      "Связанный заказ на покупку должен быть подтверждён перед проведением.",
    warehouseRequired: "Склад обязателен.",
    warehouseInactive: "Выбранный склад неактивен.",
    linesRequired: "Нужна хотя бы одна строка.",
    lineNeedsItem: "В каждой строке должна быть номенклатура.",
    qtyPositive: "Количество должно быть больше нуля.",
    itemInactive: "Выбранная позиция неактивна.",
    duplicateItems: "Дубли позиций в одном документе недопустимы.",
    itemNotOnPo: "Позиция {{code}} отсутствует в связанном заказе поставщику.",
    qtyExceedsRemaining:
      "Позиция {{code}}: количество поступления превышает остаток к получению (заказано {{ordered}}, уже получено {{already}}, в этом поступлении {{qty}}).",
    onlyDraftCancel: "Отменять можно только черновики поступлений.",
    alreadyReversed: "Это поступление уже сторнировано.",
    onlyPostedReverse: "Сторнировать можно только проведённые поступления.",
    noLinesReverse: "Нет строк поступления; сторно невозможно.",
    invalidQtyReverse:
      "В одной или нескольких строках неверное количество для сторно.",
    insufficientStockReverse:
      "Позиция {{code}}: недостаточно остатка для сторно поступления (доступно {{available}}, требуется {{required}}).",
  },
  shipment: {
    notFound: "Отгрузка не найдена.",
    onlyDraftPost: "Проводить можно только черновики отгрузок.",
    soRequired: "Нужен связанный заказ клиента.",
    soMustBeConfirmed:
      "Связанный заказ клиента должен быть подтверждён перед проведением.",
    warehouseMismatchSo:
      "Склад отгрузки должен совпадать со складом связанного заказа клиента.",
    warehouseRequired: "Склад обязателен.",
    warehouseInactive: "Выбранный склад неактивен.",
    linesRequired: "Нужна хотя бы одна строка.",
    lineNeedsItem: "В каждой строке должна быть номенклатура.",
    qtyPositive: "Количество должно быть больше нуля.",
    itemInactive: "Выбранная позиция неактивна.",
    duplicateItems: "Дубли позиций в одном документе недопустимы.",
    itemNotOnSo: "Позиция {{code}} отсутствует в связанном заказе клиента.",
    qtyExceedsRemaining:
      "Позиция {{code}}: количество отгрузки превышает остаток к отгрузке (заказано {{ordered}}, уже отгружено {{already}}, в этой отгрузке {{qty}}).",
    insufficientReserved:
      "Позиция {{code}}: недостаточно резерва для проведения (в резерве {{reserved}}, требуется {{required}}). Используйте «Резервировать» в заказе клиента.",
    insufficientStockPost:
      "Позиция {{code}}: недостаточно остатка для проведения (доступно {{available}}, требуется {{required}}).",
    noBufferWarning:
      "Позиция {{code}}: нет запаса (отгружено равно доступному остатку).",
    reservationConsumeFailed:
      "Не удалось списать резервы. Обновите документ или выполните резервирование в заказе клиента снова.",
    onlyDraftCancel: "Отменять можно только черновики отгрузок.",
    onlyDraftEdit: "Редактировать можно только черновики отгрузок.",
    invalidCarrierReference: "Выбранный перевозчик недействителен.",
    alreadyReversed: "Эта отгрузка уже сторнирована.",
    onlyPostedReverse: "Сторнировать можно только проведённые отгрузки.",
    noLinesReverse: "Нет строк отгрузки; сторно невозможно.",
    invalidQtyReverse:
      "В одной или нескольких строках неверное количество для сторно.",
  },
  import: {
    addedSkipped: "Добавлено позиций: {{added}}. Пропущено строк: {{skipped}}.",
  },
  reason: {
    cancelRequired: "Укажите причину отмены.",
    cancelInvalid: "Выберите допустимую причину отмены.",
    reversalRequired: "Укажите причину сторно.",
    reversalInvalid: "Выберите допустимую причину сторно.",
  },
  save: {
    brandDuplicate: "Бренд с таким кодом уже существует.",
    categoryDuplicate: "Категория с таким кодом уже существует.",
    supplierDuplicate: "Поставщик с таким кодом уже существует.",
    customerDuplicate: "Клиент с таким кодом уже существует.",
    warehouseDuplicate: "Склад с таким кодом уже существует.",
    carrierDuplicate: "Перевозчик с таким кодом уже существует.",
    carrierNotFound: "Перевозчик не найден.",
    itemDuplicate: "Позиция с таким кодом уже существует.",
    brandNotFound: "Бренд не найден.",
    categoryNotFound: "Категория не найдена.",
    supplierNotFound: "Поставщик не найден.",
    customerNotFound: "Клиент не найден.",
    warehouseNotFound: "Склад не найден.",
    itemNotFound: "Позиция не найдена.",
    brandInactive: "Выбранный бренд неактивен.",
    categoryInactive: "Выбранная категория неактивна.",
    purchasePriceValid: "Закупочная цена должна быть числом.",
    purchasePriceNegative: "Закупочная цена не может быть отрицательной.",
    salePriceValid: "Цена продажи должна быть числом.",
    salePriceNegative: "Цена продажи не может быть отрицательной.",
    brandSelectNotFound: "Выбранный бренд не найден.",
    categorySelectNotFound: "Выбранная категория не найдена.",
    paymentTermsValid: "Срок оплаты должен быть числом.",
    paymentTermsNegative: "Срок оплаты не может быть отрицательным.",
    poUnitPriceInvalid: "В каждой строке должна быть корректная цена (число ≥ 0).",
    poNotFound: "Заказ на покупку не найден.",
    poOnlyDraftSave: "Сохранять можно только черновики заказов на покупку.",
    poOnlyDraftConfirm: "Подтверждать можно только черновики заказов на покупку.",
    poCancelStates:
      "Отменять можно только черновики или подтверждённые заказы на покупку.",
    poReceiptConfirmedOnly:
      "Поступление можно создать только из подтверждённого заказа на покупку.",
    poFullyReceived: "Заказ на покупку уже полностью получен (проведённые поступления).",
    poDraftReceiptExists: "Для этого заказа на покупку уже есть черновик поступления.",
    poNothingToReceive: "Для этого заказа на покупку нечего получать.",
    soUnitPriceInvalid: "В каждой строке должна быть корректная цена (число ≥ 0).",
    soNotFound: "Заказ на продажу не найден.",
    soOnlyDraftSave: "Сохранять можно только черновики заказов на продажу.",
    soOnlyDraftConfirm: "Подтверждать можно только черновики заказов на продажу.",
    soAllocateConfirmedOnly: "Резервировать можно только подтверждённые заказы на продажу.",
    soCancelStates:
      "Отменять можно только черновики или подтверждённые заказы на продажу.",
    soShipmentConfirmedOnly:
      "Отгрузку можно создать только из подтверждённого заказа на продажу.",
    soFullyShipped: "Заказ на продажу уже полностью отгружен (проведённые отгрузки).",
    soDraftShipmentExists: "Для этого заказа на продажу уже есть черновик отгрузки.",
    soNothingToShip: "Для этого заказа на продажу нечего отгружать.",
    itemsPersistFailed: "Не удалось сохранить номенклатуру на диск.",
  },
};
