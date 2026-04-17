/** Employees module — Kazakh UI (full tree; deep-merge replaces English for this namespace). */
export const employeesPagesKk = {
  employees: {
    list: {
      columns: {
        employeeCode: "Қызметкер коды",
        fullName: "ТАӘ",
        displayName: "Көрсетілетін аты",
        status: "Жазба күйі",
        position: "Лауазымы",
        department: "Бөлім",
        primaryRole: "Негізгі рөлі",
        manager: "Басшы",
        erpUser: "ERP пайдаланушысы",
        accessStatus: "Қолжетімділік",
        availability: "Қолжетімділік күйі",
        lastLogin: "Соңғы кіру",
      },
    },
    page: {
      titleNew: "Жаңа қызметкер",
      titleEdit: "Қызметкер {{code}}",
      tabsAria: "Қызметкер карточкасының бөлімдері",
    },
    header: {
      record: "Жазба",
    },
    messages: {
      saved: "Қызметкер сақталды",
    },
    audit: {
      actorCurrentUser: "Ағымдағы пайдаланушы",
    },
    validation: {
      codeRequired: "Қызметкер кодын көрсетіңіз",
      fullNameRequired: "Толық аты-жөнін көрсетіңіз",
      endBeforeStart: "Аяқталу күні басталу күнінен бұрын болмауы керек",
    },
    placeholders: {
      none: "— Таңдалмаған —",
    },
    fields: {
      employeeCode: "Қызметкер коды",
      personnelNumber: "Кадр нөмірі",
      fullName: "Толық аты-жөні",
      displayName: "Көрсетілетін аты",
      status: "Жазба күйі",
      position: "Лауазымы",
      department: "Бөлім",
      directManager: "Тікелей басшы",
      employmentStart: "Жұмысқа кіру күні",
      employmentEnd: "Жұмыстан шығу күні",
      comment: "Ескерту",
      workEmail: "Жұмыс e-mail",
      workPhone: "Жұмыс телефоны",
      internalExtension: "Ішкі қосымша",
      officeLocation: "Кеңсе / филиал / орналасу",
      functionalManager: "Функционалды басшы",
      teamOrGroup: "Команда / топ",
      responsibilityZone: "Жауапкершілік аймағы",
    },
    tabs: {
      main: {
        nav: "Негізгі",
        identityTitle: "Негізгі сәйкестендіру",
      },
      org: {
        nav: "Ұйым және жауапкершілік",
        structureTitle: "Ұйымдағы орны",
      },
      contacts: {
        nav: "Байланыстар",
        title: "Жұмыс байланыстары",
        messengerLabel: "Корп. мессенджер",
      },
    },
    enums: {
      recordStatus: {
        active: "Белсенді",
        inactive: "Белсенді емес",
        terminated: "Жұмыстан босатылған",
      },
      accessStatus: {
        active: "Белсенді",
        blocked: "Бұғатталған",
        pending: "Күтуде",
      },
      availability: {
        active: "Жұмыста",
        vacation: "Демалыс",
        sick_leave: "Ауру",
        dismissed: "Босатылған",
        temporarily_unavailable: "Уақытша қолжетімсіз",
      },
    },
    dict: {
      department: {
        FINANCE: "Қаржы",
        LOGISTICS: "Логистика",
        PURCHASING: "Сатып алу",
        MERCH: "Мерчандизинг",
        OPS: "Операциялар",
        IT: "АТ",
      },
      position: {
        FIN_CONTROLLER: "Қаржы контролері",
        WAREHOUSE_LEAD: "Қойма жетекшісі",
        BUYER: "Сатып алушы",
        CONTENT_MANAGER: "Контент менеджері",
        OPERATOR: "Оператор",
        SYS_ADMIN: "Жүйе әкімшісі",
      },
      systemRole: {
        VIEWER: "Көруші",
        OPERATIONS: "Операциялар",
        FINANCE: "Қаржы",
        MERCH: "Мерчандизинг",
        ADMIN: "Әкімші",
      },
    },
  },
};
