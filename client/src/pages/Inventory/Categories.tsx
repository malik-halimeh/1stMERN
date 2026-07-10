import { useEffect, useState } from "react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";


interface SubCategory {
    _id: string;
    name: string;
    slug: string;
    createdAt: string;
}


interface Category {
    _id: string;
    name: string;
    slug: string;
    createdAt: string;
    subcategories: SubCategory[];
}


const Categories = () => {

    const { user } = useAuth();
    // Category mutations are staff scoped server-side (manager + super admin)
    const canManage = user?.role === "inventory_manager" || user?.role === "super_admin";

    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    const [showForm, setShowForm] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        slug: "",
        parentId: ""
    });



    const fetchCategories = async () => {

        try {

            const res = await api.get("/categories");

            setCategories(res.data.data);

        } catch (error) {

            console.error(error);

        } finally {

            setLoading(false);

        }
    };



    useEffect(() => {
        fetchCategories();
    }, []);




    const createCategory = async () => {

        try {

            await api.post("/categories", {
                name: formData.name,
                slug: formData.slug,
                parentId: formData.parentId || null
            });


            setFormData({
                name: "",
                slug: "",
                parentId: ""
            });


            setShowForm(false);

            fetchCategories();


        } catch (error) {

            console.error(error);

        }

    };





    const deleteCategory = async (id: string) => {

        try {

            await api.delete(`/categories/${id}`);


            fetchCategories();


        } catch (error) {

            console.error(error);

        }

    };






    return (

        <div className="space-y-6">



            {/* Header */}

            <div className="
                flex
                items-center
                justify-between
                gap-3
                flex-wrap
            ">


                <div>

                    <h1 className="
                        text-2xl
                        font-semibold
                        text-text-primary
                    ">
                        Categories
                    </h1>


                    <p className="
                        mt-1
                        text-sm
                        text-text-secondary
                    ">
                        Manage product categories and subcategories.
                    </p>


                </div>




                {canManage && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="
                            rounded-lg
                            bg-primary
                            px-4
                            py-2
                            text-sm
                            font-medium
                            text-white
                            transition
                            hover:opacity-90
                        "
                    >
                        Add Category
                    </button>
                )}


            </div>






            {/* Create Form */}

            {showForm && (

                <div className="
                    rounded-xl
                    border
                    border-border
                    bg-surface
                    p-6
                    space-y-4
                ">


                    <h2 className="
                        font-medium
                        text-text-primary
                    ">
                        Create Category
                    </h2>



                    <input
                        placeholder="Category name"
                        value={formData.name}
                        onChange={(e) =>
                            setFormData({
                                ...formData,
                                name: e.target.value
                            })
                        }
                        className="
                            w-full
                            rounded-lg
                            border
                            border-border
                            bg-background
                            px-3
                            py-2
                            text-text-primary
                        "
                    />



                    <input
                        placeholder="Slug"
                        value={formData.slug}
                        onChange={(e) =>
                            setFormData({
                                ...formData,
                                slug: e.target.value
                            })
                        }
                        className="
                            w-full
                            rounded-lg
                            border
                            border-border
                            bg-background
                            px-3
                            py-2
                            text-text-primary
                        "
                    />





                    <select

                        value={formData.parentId}

                        onChange={(e) =>
                            setFormData({
                                ...formData,
                                parentId: e.target.value
                            })
                        }

                        className="
                            w-full
                            rounded-lg
                            border
                            border-border
                            bg-background
                            px-3
                            py-2
                            text-text-primary
                        "
                    >

                        <option value="">
                            Root Category
                        </option>


                        {categories.map(category => (

                            <option
                                key={category._id}
                                value={category._id}
                            >
                                {category.name}
                            </option>

                        ))}


                    </select>






                    <div className="flex gap-3">


                        <button

                            onClick={createCategory}

                            className="
                                rounded-lg
                                bg-primary
                                px-4
                                py-2
                                text-sm
                                text-white
                            "
                        >
                            Save
                        </button>




                        <button

                            onClick={() => setShowForm(false)}

                            className="
                                rounded-lg
                                border
                                border-border
                                px-4
                                py-2
                                text-sm
                                text-text-secondary
                            "
                        >
                            Cancel
                        </button>


                    </div>


                </div>

            )}









            {/* Categories List */}


            <div className="
                rounded-xl
                border
                border-border
                bg-surface
                overflow-hidden
            ">


                {loading ? (

                    <div className="p-6 space-y-4">


                        {[1, 2, 3].map(i => (

                            <div
                                key={i}
                                className="
                                    h-14
                                    rounded-lg
                                    bg-background
                                    animate-pulse
                                "
                            />

                        ))}


                    </div>


                ) : (


                    categories.map(category => (


                        <div
                            key={category._id}
                            className="
                                border-b
                                border-border
                                last:border-none
                            "
                        >



                            <div className="
                                flex
                                items-center
                                justify-between
                                px-6
                                py-4
                            ">


                                <div>


                                    <h3 className="
                                        font-medium
                                        text-text-primary
                                    ">
                                        {category.name}
                                    </h3>


                                    <p className="
                                        text-sm
                                        text-text-secondary
                                    ">
                                        {category.subcategories.length}
                                        {" "}
                                        subcategories
                                    </p>


                                </div>





                                {canManage && (
                                    <button
                                        onClick={() =>
                                            deleteCategory(category._id)
                                        }
                                        className="
                                            rounded-lg
                                            border
                                            border-red-500/30
                                            px-3
                                            py-1.5
                                            text-xs
                                            text-red-600
                                        "
                                    >
                                        Delete
                                    </button>
                                )}


                            </div>







                            {category.subcategories.length > 0 && (

                                <div className="
                                    mx-6
                                    mb-4
                                    rounded-lg
                                    bg-background
                                    p-4
                                    space-y-3
                                ">


                                    {category.subcategories.map(sub => (


                                        <div

                                            key={sub._id}

                                            className="
                                                flex
                                                justify-between
                                                items-center
                                            "

                                        >

                                            <span className="
                                                text-sm
                                                text-text-secondary
                                            ">
                                                ↳ {sub.name}
                                            </span>



                                            {canManage && (
                                                <button
                                                    onClick={() =>
                                                        deleteCategory(sub._id)
                                                    }
                                                    className="
                                                        text-xs
                                                        text-red-600
                                                    "
                                                >
                                                    Delete
                                                </button>
                                            )}


                                        </div>


                                    ))}


                                </div>


                            )}




                        </div>


                    ))


                )}


            </div>



        </div>

    );
};


export default Categories;