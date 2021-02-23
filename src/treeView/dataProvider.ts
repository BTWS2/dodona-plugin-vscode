import {
    Event,
    EventEmitter,
    ProviderResult,
    TreeDataProvider,
    TreeItem,
} from "vscode";
import { AbstractTreeItem } from "./items/abstractTreeItem";
import execute from "../api/client";
import { YearTreeItem } from "./items/yearTreeItem";
import {
    getSortOption,
    getYearFilter,
    getCourseFilter,
} from "../configuration";
import { Course } from "../api/resources/course";

// TODO add an icon for course & series to make them easier to separate in the view

/**
 * Data provider for the exercise tree view.
 */

export default class RootDataProvider
    implements TreeDataProvider<AbstractTreeItem> {
    private _onDidChangeTreeData: EventEmitter<
        AbstractTreeItem | undefined
    > = new EventEmitter<AbstractTreeItem | undefined>();
    readonly onDidChangeTreeData: Event<AbstractTreeItem | undefined> = this
        ._onDidChangeTreeData.event;

    getChildren(
        element?: AbstractTreeItem,
    ): ProviderResult<AbstractTreeItem[]> {
        if (element) {
            // Element in the tree.
            return element.getChildren();
        }

        // Get the courses the user is subscribed to.
        return (
            execute(dodona => dodona.courses.subscribed)
                // Sort courses & apply filters
                .then(cs =>
                    RootDataProvider.sortCourses(this.filterCourses(cs || [])),
                )
                // Convert them to tree items.
                .then(cs =>
                    this.getYears(cs).map(
                        y => new YearTreeItem(y, this.getCoursesForYear(y, cs)),
                    ),
                )
        );
    }

    /**
     * Get all academic years in a list of courses
     * @param courses
     */
    getYears(courses: Course[]): string[] {
        const yearArray: string[] = [];

        /**
         * Create a unique array of all academic years
         * Can't use a set because order is important
         */
        courses.forEach(function (course) {
            if (!yearArray.includes(course.year)) {
                yearArray.push(course.year);
            }
        });

        return yearArray;
    }

    /**
     * Get all courses with a given academic year
     */
    getCoursesForYear(year: string, courses: Course[]): Course[] {
        return courses.filter(c => c.year == year);
    }

    getTreeItem(element: AbstractTreeItem): TreeItem {
        return element;
    }

    refresh(): void {
        // TODO optimise this to not redraw the entire tree.
        this._onDidChangeTreeData.fire(undefined);
    }

    static sortCourses(courses: Course[]): Course[] {
        const sortOption = getSortOption();

        // Asc/Desc is just switching the 1's and -1's,
        // so this can be made a bit abstract to avoid duplication
        const priority = sortOption.includes("ascending") ? -1 : 1;

        // Sorting always puts the second option descending to make it easier to read

        // Sort by name first
        if (sortOption.startsWith("Alphabetic")) {
            return courses.sort((a, b) =>
                a.name < b.name
                    ? priority
                    : a.name > b.name
                    ? -priority
                    : a.year < b.year
                    ? -1
                    : a.year > b.year
                    ? 1
                    : 0,
            );
        } else {
            // Sort by year first
            return courses.sort((a, b) =>
                a.year < b.year
                    ? priority
                    : a.year > b.year
                    ? -priority
                    : a.name < b.name
                    ? -1
                    : a.name > b.name
                    ? 1
                    : 0,
            );
        }
    }

    filterCourses(courses: Course[]): Course[] {
        // Remove spaces that were added accidentally by students ("a, b" -> "a,b")
        const yearFilter = getYearFilter().replace(/\s/g, "");
        const courseFilter = getCourseFilter().replace(/\s/g, "");

        // Apply filters if they were supplied
        if (yearFilter) {
            // Filter out double/trailing comma's & empty entries/invalid entries
            const year_filters = yearFilter.split(",").filter(
                // Check for valid years
                y => !isNaN(+y) && y.length === 4 && parseInt(y) >= 2016,
            );

            // Remove courses from other academic years
            courses = courses.filter(c =>
                year_filters.includes(c.year.substring(0, 4)),
            );
        }

        if (courseFilter) {
            // Filter out double/trailing comma's & empty entries/invalid entries
            const course_filters = courseFilter
                .split(",")
                // Check for valid course id's
                .filter(c => !isNaN(+c) && c.length > 0 && parseInt(c) >= 0);

            // Remove courses with id's that aren't in the list
            courses = courses.filter(c =>
                course_filters.includes(c.id.toString()),
            );
        }

        return courses;
    }
}
