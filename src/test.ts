import { readLinksCsv, LinkRow } from "./read_links";
import dotenv from "dotenv";
dotenv.config();
import { Builder, By, Key, until, WebDriver } from "selenium-webdriver";
import { updateLinksCsv, updateLinkCsv } from "./read_links";

const MAIN_PAGE_URL = process.env.MAIN_PAGE_URL;
const ADMIN_USER_NAME = process.env.ADMIN_USER_NAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const COURSE_URL = process.env.COURSE_URL;

async function runTest() {
  console.log("[runTest] Start");
  if (!MAIN_PAGE_URL || !ADMIN_USER_NAME || !ADMIN_PASSWORD || !COURSE_URL) {
    throw new Error(
      "Missing MAIN_PAGE_URL, ADMIN_USER_NAME, or ADMIN_PASSWORD in environment variables"
    );
  }
  console.log("[runTest] Building WebDriver");
  let driver = await new Builder().forBrowser("chrome").build();
  try {
    console.log("[runTest] Navigating to MAIN_PAGE_URL");
    await driver.get(MAIN_PAGE_URL);
    console.log("[runTest] Waiting for login form");
    // Wait for login form to appear (customize selector as needed)
    await driver.wait(until.elementLocated(By.name("username")), 5000);
    console.log("[runTest] Filling login info");
    await driver.findElement(By.name("username")).sendKeys(ADMIN_USER_NAME);
    await driver.findElement(By.name("password")).sendKeys(ADMIN_PASSWORD);
    await driver.findElement(By.css('button[type="submit"]')).click();
    console.log("[runTest] Submitted login");
    // Wait for login to complete (customize selector as needed)
    await driver.wait(until.urlContains("/user"), 5000);
    console.log("[runTest] Login complete");

    console.log("[runTest] Navigating to COURSE_URL");
    await driver.get(COURSE_URL);

    // Click the element with id 'setmode'
    console.log("[runTest] Setting mode");
    await driver.wait(until.elementLocated(By.name("setmode")), 5000);
    await driver.findElement(By.name("setmode")).click();

    console.log("[runTest] Calling processUpdateData");
    await processUpdateData(0, 2, driver);
    console.log("[runTest] Login successful");
    // Wait for 1 minute (60000 ms)
    console.log("[runTest] Sleeping 60s");
    await driver.sleep(60000);
  } finally {
    console.log("[runTest] Quitting driver");
    await driver.quit();
  }
}

async function processUpdateData(
  startRow: number,
  endRow: number,
  driver: WebDriver
) {
  // Đọc toàn bộ data từ file_links.csv
  console.log("[processUpdateData] Reading CSV");
  const rowData: LinkRow[] = readLinksCsv();
  // startRow và endRow là tham số truyền vào
  const newRows: LinkRow[] = [];
  console.log(`[processUpdateData] Looping from ${startRow} to ${endRow}`);
  for (let i = startRow; i < endRow; i++) {
    console.log(`[processUpdateData] Processing row ${i}`);
    const row = rowData[i];
    if (row.Status === "Completed") {
      console.log(`[processUpdateData] Row ${i} already completed, skipping`);
      continue;
    }
    let fileName = row.FileName.replace(/\.mp4$/i, "");
    let courseName = row.ParentFolders.split("/").pop() || "";
    courseName = courseName.replace(/^[^a-zA-Z]+/, "").trim();
    let indexMatch = row.FileName.match(/^(\d+)\.|\((\d+)\)/);
    let index = "1";
    if (indexMatch) {
      if (indexMatch[2]) {
        index = String(Number(indexMatch[2]) + 1);
      } else {
        index = indexMatch[1] || "1";
      }
    }
    const lessonName = `Bài ${index}`;
    // fileName = fileName
    //   .replace(/\(\d+\)$/, "")
    //   .replace(/^[^a-zA-Z]+/, "")
    //   .trim();
    newRows.push({
      ...row,
      NewFileName: fileName,
      CourseName: courseName,
      LessonName: lessonName,
    });
    try {
      console.log(`[processUpdateData] Creating course for row ${i}`);
      await createCourse(
        driver,
        courseName,
        fileName,
        lessonName,
        row.DownloadLink
      );
      row.Status = "Completed";
      updateLinkCsv(row);
      console.log(`[processUpdateData] Row ${i} completed and updated`);
    } catch (error) {
      console.log(`[processUpdateData] Error processing row ${i}:`, error);
    }
  }
}

async function createCourse(
  driver: WebDriver,
  courseName: string,
  fileName: string,
  lessonName: string,
  url: string
) {
  // Tìm thẻ a có text 'Các Khoá học ứng dụng khác' và click
  // console.log(`[createCourse] Looking for link: Các Khoá học ứng dụng khác`);
  // const linkText = "Các Khoá học ứng dụng khác";
  // const aTag = await driver.findElement(
  //   By.xpath(`//a[contains(text(), '${linkText}')]`)
  // );
  // await aTag.click();
  await driver.sleep(2000);

  console.log(`[createCourse] Looking for courseName link: ${courseName}`);
  const courseNameLinks = await driver.findElements(
    By.xpath(`//a[contains(text(), '${courseName}')]`)
  );
  if (courseNameLinks.length > 0) {
    await courseNameLinks[0].click();
    console.log(
      `[createCourse] Clicked courseName, waiting for 'Chỉnh sửa' link...`
    );
    const editLink = await driver.wait(
      until.elementLocated(By.xpath("//a[contains(text(), 'Chỉnh sửa')]")),
      10000
    );
    console.log(`[createCourse] Found 'Chỉnh sửa' link, clicking...`);
    await editLink.click();
    console.log(
      `[createCourse] Clicked 'Chỉnh sửa', waiting for 'Khoá học' link...`
    );
    const courseTabLink = await driver.wait(
      until.elementLocated(
        By.xpath(
          "//a[contains(text(), 'Khoá học') and @role='menuitem' and contains(@href, 'course/view.php?id=')]"
        )
      ),
      10000
    );
    console.log(`[createCourse] Found 'Khoá học' link, clicking...`);
    await courseTabLink.click();
    console.log(`[createCourse] Clicked 'Khoá học', creating lesson`);
    try {
      await createLesson(driver, fileName, lessonName, url);
    } catch (error) {
      console.log(`[createCourse] Error creating lesson:`, error);
      throw error;
    }
  } else {
    console.log(`[createCourse] CourseName not found, creating new course`);
    console.log(`[createCourse] Clicking 'Tạo khoá học mới' button`);
    const createCourseButton = await driver.findElement(
      By.xpath(`//a[contains(text(), 'Tạo khóa học mới')]`)
    );
    await createCourseButton.click();
    console.log(`[createCourse] Filling course name inputs`);
    const courseNameInput = await driver.findElement(By.name("fullname"));
    await courseNameInput.sendKeys(courseName);
    const shortCourseNameInput = await driver.findElement(By.name("shortname"));
    await shortCourseNameInput.sendKeys(courseName);

    console.log(`[createCourse] Selecting start date`);
    const selectDay = await driver.findElement(By.id("id_startdate_day"));
    await selectDay.findElement(By.css('option[value="17"]')).click();

    console.log(`[createCourse] Clicking save and display`);
    const saveButton = await driver.findElement(By.id("id_saveanddisplay"));
    await saveButton.click();

    console.log(`[createCourse] Creating lesson for new course`);
    await createLesson(driver, fileName, lessonName, url);
  }
}

async function createLesson(
  driver: WebDriver,
  fileName: string,
  lessonName: string,
  url: string
) {
  console.log("[Step] Waiting for course/view URL...");
  await driver.wait(until.urlContains("course/view"), 10000);
  // Chọn element div đầu tiên có class name = section-item, nếu không có thì click vào thẻ a có text 'Add section'
  console.log(
    "[Step] Finding sectionItems: li[data-sectionname='New section'] ..."
  );
  const sectionItems = await driver.findElements(
    By.css("li[data-sectionname='New section']")
  );
  if (sectionItems.length > 0) {
    console.log("[Step] Found section-item, looking for quickeditlink...");
    // Đã có section-item, tìm thẻ a có class 'quickeditlink aalink'
    const quickEditLink = await sectionItems[0].findElement(
      By.css("a.quickeditlink.aalink")
    );
    console.log("[Step] Clicking quickeditlink...");
    await quickEditLink.click();
    // Tìm thẻ input type=text và dán lessonName
    console.log("[Step] Finding text input for lessonName...");
    await driver.wait(
      until.elementLocated(By.css('input[type="text"][id*="id_inplacevalue"]')),
      10000
    );
    const textInput = await sectionItems[0].findElement(
      By.css('input[type="text"][id*="id_inplacevalue"]')
    );
    await textInput.clear();
    await textInput.sendKeys(lessonName);
    await textInput.sendKeys(Key.ENTER);

    // Tìm button có text 'Thêm một hoạt động hoặc tài nguyên'
    console.log(
      "[Step] Finding 'Thêm một hoạt động hoặc tài nguyên' button..."
    );
    const addActivityButtons = await sectionItems[0].findElement(
      By.css('button[data-action="open-chooser"]')
    );
    if (addActivityButtons) {
      console.log("[Step] Clicking add activity/resource button...");
      await addActivityButtons.click();
      console.log("[Step] Waiting for activity/resource modal...");
      const urlLink = await driver.wait(
        until.elementLocated(By.css('a[title="Thêm mới một URL"]')),
        10000
      );
      console.log("[Step] Clicking 'Thêm mới một URL' link...");
      await urlLink.click();

      console.log("[Step] Waiting for input[type='text']#id_name ...");
      await driver.wait(
        until.elementLocated(By.css('input[type="text"]#id_name')),
        5000
      );
      // Tìm input type=text, id=id_name và truyền value là fileName
      console.log("[Step] Filling fileName in id_name input...");
      const nameInput = await driver.findElement(
        By.css('input[type="text"]#id_name')
      );
      await nameInput.clear();
      await nameInput.sendKeys(fileName);

      console.log("[Step] Filling url in id_externalurl input...");
      const urlInput = await driver.findElement(
        By.css('input[type="url"]#id_externalurl')
      );
      await urlInput.clear();
      await urlInput.sendKeys(url);

      // Tìm submit button có id = id_submitbutton2, click
      console.log("[Step] Clicking submit button id_submitbutton2...");
      const submitButton2 = await driver.findElement(By.id("id_submitbutton2"));
      await submitButton2.click();

      await driver.sleep(5000);
      await driver.get(COURSE_URL || "");
      await driver.sleep(3000);
    }

    return;
  } else {
    const addSectionLinks = await driver.findElements(
      By.xpath("//a[contains(text(), 'Add section')]")
    );
    if (addSectionLinks.length > 0) {
      await addSectionLinks[0].click();
    }
    await createLesson(driver, fileName, lessonName, url);
    return;
  }
}

// Chạy hàm chính
runTest().catch((error) => {
  console.error("Error in runTest:", error);
});
